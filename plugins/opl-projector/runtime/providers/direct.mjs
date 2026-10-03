import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService } from 'vscode-html-languageservice';
import { getCSSLanguageService, getSCSSLanguageService, getLESSLanguageService } from 'vscode-css-languageservice';
import { uri, readSource, languageId, symbols, locations, addFact, gap } from './common.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export async function direct(context, request) {
  const html = request.provider === 'html';
  const engine = html ? 'vscode-html-languageservice' : 'vscode-css-languageservice';
  context.engine = {name:engine,version:require(`${engine}/package.json`).version};
  context.capabilities = html ? ['symbols', 'references'] : ['symbols', 'definitions', 'references', 'diagnostics'];
  if (!context.capabilities.includes(request.operation)) {
    gap(context, 'unsupported-operation', `${request.provider} service does not support ${request.operation}`);
    return;
  }
  for (const file of context.files) {
    try {
      const id = languageId(file);
      if (html ? id !== 'html' : !['css','scss','less'].includes(id)) {
        gap(context, 'unsupported-language', `The ${request.provider} service cannot analyze ${id}`, file);
        continue;
      }
      const document = TextDocument.create(await uri(context.root, file), id, 1, await readSource(context.root, file));
      const service = html ? getLanguageService() : id === 'scss' ? getSCSSLanguageService() : id === 'less' ? getLESSLanguageService() : getCSSLanguageService();
      const parsed = html ? service.parseHTMLDocument(document) : service.parseStylesheet(document);
      if (request.operation === 'symbols') await symbols(context, service.findDocumentSymbols(document, parsed), file);
      else if (request.operation === 'diagnostics') {
        for (const diagnostic of service.doValidation(document, parsed)) await addFact(context, {kind:'diagnostic',path:file,...diagnostic});
      } else {
        if (!request.position) throw new Error(`${request.operation} requires position`);
        if (html) {
          for (const highlight of service.findDocumentHighlights(document, request.position, parsed)) await addFact(context, {kind:'document-highlight', path:file, range:highlight.range, highlightKind:highlight.kind});
          gap(context, 'document-local-references', 'HTML references are document highlights; they do not resolve cross-file references', file);
        } else await locations(context, request.operation === 'definitions' ? service.findDefinition(document, request.position, parsed) : service.findReferences(document, request.position, parsed), request.operation === 'definitions' ? 'definition' : 'reference');
      }
    } catch (error) { gap(context, 'service-failed', error.message, file); }
  }
}
