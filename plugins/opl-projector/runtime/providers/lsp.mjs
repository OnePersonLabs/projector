import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, CancellationTokenSource } from 'vscode-jsonrpc/node';
import { uri, languageId, readSource, symbols, locations, addFact, sourcePath, gap } from './common.mjs';

const operations = {symbols:['documentSymbolProvider','textDocument/documentSymbol'],definitions:['definitionProvider','textDocument/definition'],references:['referencesProvider','textDocument/references'],diagnostics:['diagnosticProvider','textDocument/diagnostic']};

export async function lsp(context, request) {
  const config = request.config;
  if (!config?.command || !Array.isArray(config.args) || !config.args.every(arg => typeof arg === 'string')) {
    gap(context, 'lsp-unconfigured', 'LSP requires an explicit config.command and config.args array');
    return;
  }
  if (request.timeoutMs !== undefined && (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0)) throw new Error('timeoutMs must be a positive resource budget');
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (config.experimentalCapabilities !== undefined && !object(config.experimentalCapabilities)) throw new Error('config.experimentalCapabilities must be an object');
  const readiness = config.readiness;
  if (readiness !== undefined) {
    const primitive = value => value === null || ['string','boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
    if (!object(readiness) || typeof readiness.notification !== 'string' || !readiness.notification.trim() || !object(readiness.equals) || !Object.keys(readiness.equals).length || !Object.values(readiness.equals).every(primitive)) throw new Error('config.readiness requires a notification and a nonempty equals map of primitive values');
    if (request.timeoutMs === undefined) throw new Error('Configured LSP readiness requires an explicit positive timeoutMs resource budget');
    context.readiness = {notification:readiness.notification,equals:readiness.equals,status:'unconfirmed',observed:null};
  }
  const child = spawn(config.command, config.args, {cwd:context.root,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const closed = new Promise(resolve => child.once('close', resolve));
  let ended = false;
  let exiting = false;
  let failure;
  let rejectFailure;
  const stopped = new Promise((_, reject) => { rejectFailure = reject; });
  // Register a handler immediately, including when spawning fails before initialize.
  stopped.catch(() => {});
  const fail = error => { if (!failure) { failure = error; rejectFailure(error); } };
  child.on('error', fail);
  child.on('exit', (code, signal) => { ended = true; if (!exiting || code !== 0) fail(new Error(`LSP server exited (code ${code}, signal ${signal})`)); });
  child.stderr.on('data', data => { context.serverStderr = ((context.serverStderr ?? '') + data.toString()).slice(-8192); });
  const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  const cancellation = new CancellationTokenSource();
  const cancel = () => {
    cancellation.cancel();
    fail(new Error(request.signal?.aborted ? 'LSP observation cancelled' : 'LSP resource budget exhausted'));
  };
  let budget;
  if (request.timeoutMs !== undefined) budget = setTimeout(cancel, request.timeoutMs);
  request.signal?.addEventListener('abort', cancel, {once:true});
  if (request.signal?.aborted) cancel();
  connection.onClose(() => { if (!exiting) fail(new Error('LSP transport closed')); });
  connection.onError(([error]) => fail(error));
  connection.onRequest('workspace/configuration', params => (params.items ?? []).map(() => config.settings ?? null));
  connection.onRequest('workspace/workspaceFolders', () => [{uri:pathToFileURL(context.root).href,name:'project'}]);
  connection.onRequest('client/registerCapability', () => null);
  connection.onRequest('window/workDoneProgress/create', () => null);
  let notifyReadiness;
  const observeReadiness = params => {
    context.readiness.observed = params ?? null;
    // This is the latest server status, not a latch or a source-analysis barrier.
    context.readiness.status = object(params) && Object.entries(readiness.equals).every(([key,value]) => params[key] === value) ? 'matched' : 'unconfirmed';
    notifyReadiness?.();
  };
  if (readiness && readiness.notification !== 'textDocument/publishDiagnostics') connection.onNotification(readiness.notification, observeReadiness);
  const awaitReadiness = async () => {
    while (readiness && context.readiness.status !== 'matched') {
      if (failure) throw failure;
      await Promise.race([new Promise(resolve => { notifyReadiness = resolve; }), stopped]);
    }
    if (failure) throw failure;
  };
  const notifications = new Set();
  connection.onNotification('textDocument/publishDiagnostics', params => {
    if (readiness?.notification === 'textDocument/publishDiagnostics') observeReadiness(params);
    const task = (async () => {
    try {
      const file = await sourcePath(context.root, params.uri);
      if (!context.files.includes(file)) return;
      if (request.operation !== 'diagnostics') return;
      for (const diagnostic of params.diagnostics ?? []) await addFact(context, {kind:'diagnostic',path:file,...diagnostic});
    } catch (error) { gap(context, 'diagnostic-rejected', error.message); }
    })();
    notifications.add(task);
    task.finally(() => notifications.delete(task));
  });
  connection.listen();
  const send = (method, ...params) => failure ? Promise.reject(failure) : Promise.race([connection.sendRequest(method, ...params, cancellation.token), stopped]);
  let initialized = false;
  try {
    if (failure) throw failure;
    const result = await send('initialize', {processId:process.pid,rootUri:pathToFileURL(context.root).href,workspaceFolders:[{uri:pathToFileURL(context.root).href,name:'project'}],capabilities:{textDocument:{diagnostic:{dynamicRegistration:false},documentSymbol:{hierarchicalDocumentSymbolSupport:true}},workspace:{configuration:true,workspaceFolders:true},...(config.experimentalCapabilities ? {experimental:config.experimentalCapabilities} : {})},initializationOptions:config.initializationOptions ?? null});
    initialized = true;
    context.engine = {name:result.serverInfo?.name ?? config.command,version:result.serverInfo?.version ?? null};
    if (!context.engine.version) gap(context, 'engine-version-unavailable', 'The server did not report its engine version; retain this provenance gap');
    await connection.sendNotification('initialized', {});
    const capabilities = result.capabilities ?? {};
    context.capabilities = Object.entries(operations).filter(([, [capability]]) => Boolean(capabilities[capability])).map(([operation]) => operation);
    const operation = operations[request.operation];
    if (!operation || !capabilities[operation[0]]) {
      gap(context, 'unsupported-operation', `LSP server does not advertise ${request.operation}; push diagnostics alone cannot prove a completed diagnostic request`);
      return;
    }
    for (const file of context.files) {
      try {
        if (failure) throw failure;
        const documentUri = await uri(context.root, file);
        await connection.sendNotification('textDocument/didOpen', {textDocument:{uri:documentUri,languageId:languageId(file),version:1,text:await readSource(context.root,file)}});
        const params = {textDocument:{uri:documentUri}};
        if (['definitions','references'].includes(request.operation)) {
          if (!request.position) throw new Error(`${request.operation} requires position`);
          params.position = request.position;
          if (request.operation === 'references') params.context = {includeDeclaration:request.includeDeclaration ?? true};
        }
        await awaitReadiness();
        const response = await send(operation[1], params);
        if (request.operation === 'symbols') await symbols(context,response,file);
        else if (request.operation === 'diagnostics') {
          if (response?.kind !== 'full') gap(context,'diagnostic-report-incomplete','Server returned a diagnostic report without full items',file);
          else for (const diagnostic of response.items ?? []) await addFact(context,{kind:'diagnostic',path:file,...diagnostic});
          for (const [target, report] of Object.entries(response?.relatedDocuments ?? {})) {
            if (report.kind === 'full') for (const diagnostic of report.items ?? []) await addFact(context,{kind:'diagnostic',path:target,...diagnostic});
          }
        } else await locations(context,response,request.operation === 'definitions' ? 'definition' : 'reference');
        await connection.sendNotification('textDocument/didClose', {textDocument:{uri:documentUri}});
      } catch (error) { gap(context,'lsp-request-failed',error.message,file); if (failure) break; }
    }
  } catch (error) { gap(context,'lsp-failed',error.message); }
  finally {
    // Shutdown has the same caller budget as observation. No hidden correctness deadline.
    try {
      if (initialized && !failure && !ended) {
        await send('shutdown');
        exiting = true;
        await connection.sendNotification('exit');
        await Promise.race([closed, stopped]);
      }
    } catch (error) { gap(context,'lsp-shutdown-failed',error.message); }
    finally {
      clearTimeout(budget);
      request.signal?.removeEventListener('abort',cancel);
      cancellation.dispose();
      connection.dispose();
      await Promise.all(notifications);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      if (!ended) child.kill();
      await closed;
      if (readiness && context.readiness.status !== 'matched') gap(context,'lsp-readiness-unconfirmed',`The latest ${readiness.notification} notification did not match the configured readiness fields`);
    }
  }
}
