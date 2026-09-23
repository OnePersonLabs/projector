import ts from 'typescript';
import type { FileRecord, Unit } from './types.ts';
import { addressPath, component, hash, normalizeName } from './common.ts';

function signature(node: ts.Node, source: ts.SourceFile): string {
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    const first = node.members.pos;
    return source.text.slice(node.getStart(source), first) + node.members.map(member => signature(member, source)).join('\n') + '}';
  }
  const callable = node as ts.Node & { body?: ts.Node; initializer?: ts.Node };
  if (callable.body) return source.text.slice(node.getStart(source), callable.body.getStart(source)).trimEnd();
  if (callable.initializer) return source.text.slice(node.getStart(source), callable.initializer.getStart(source)).replace(/=\s*$/, '').trimEnd();
  return node.getText(source);
}
export function extractCode(record: FileRecord): void {
  const scriptKind = /\.tsx$/.test(record.path) ? ts.ScriptKind.TSX : /\.(jsx|js|mjs|cjs)$/.test(record.path) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(record.path, record.source, ts.ScriptTarget.Latest, true, scriptKind);
  const parseDiagnostics = (source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  for (const diagnostic of parseDiagnostics) record.diagnostics.push({ code: 'code-syntax-unknown', message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), path: record.path });
  record.bindings = []; record.exportStars = [];
  const symbols = new Map<string, Unit>();
  const add = (name: string, node: ts.Node, exported: boolean, parent?: string): void => {
    const logicalName = parent ? `${parent}.${name}` : name;
    const address = `code:${addressPath(record.path)}#${component(logicalName)}`;
    const body = node.getText(source), contract = signature(node, source);
    const existing = symbols.get(logicalName);
    if (existing) {
      const previousKind = existing.data?.declarationKind;
      const kind = ts.SyntaxKind[node.kind];
      const mergeable = (previousKind === 'InterfaceDeclaration' && kind === 'InterfaceDeclaration')
        || previousKind === 'ModuleDeclaration' || kind === 'ModuleDeclaration'
        || (previousKind === 'FunctionDeclaration' && kind === 'FunctionDeclaration' && !(existing.data?.implementation && (node as ts.FunctionDeclaration).body));
      if (!mergeable) record.diagnostics.push({ code: 'code-symbol-identity-unknown', message: `Repeated declaration ${logicalName} cannot be proven to be a legal merged symbol.`, path: record.path, address });
      existing.body += `\n${body}`; existing.bodyHash = hash(existing.body);
      existing.data!.contract = `${String(existing.data!.contract)}\n${contract}`;
      existing.contractHash = hash(String(existing.data!.contract)); existing.exported ||= exported;
      if (ts.isFunctionDeclaration(node) && node.body) existing.data!.implementation = true;
      return;
    }
    const unit: Unit = { id: address, kind: 'symbol', name: logicalName, key: normalizeName(name), path: record.path, address, body,
      bodyHash: hash(body), contractHash: hash(contract), exported, parent: parent ? `code:${addressPath(record.path)}#${component(parent)}` : undefined,
      data: { start: node.getStart(source), end: node.end, topLevel: !parent, contract, declarationKind: ts.SyntaxKind[node.kind], implementation: ts.isFunctionDeclaration(node) && Boolean(node.body) } };
    record.units.push(unit); symbols.set(logicalName, unit);
  };
  for (const node of source.statements) {
    const exported = ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text; record.imports.push(module);
      if (node.importClause?.name) record.bindings.push({ local: node.importClause.name.text, imported: 'default', module });
      const named = node.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) for (const element of named.elements) record.bindings.push({ local: element.name.text, imported: element.propertyName?.text ?? element.name.text, module });
      else if (named && ts.isNamespaceImport(named)) record.bindings.push({ local: named.name.text, imported: '*', module });
      continue;
    }
    if (ts.isExportDeclaration(node)) {
      const module = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
      if (module) record.imports.push(module);
      if (!node.exportClause && module) record.exportStars.push(module);
      else if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const element of node.exportClause.elements) record.bindings.push({ local: element.propertyName?.text ?? element.name.text, imported: element.propertyName?.text ?? element.name.text, module, exported: element.name.text });
      else record.diagnostics.push({ code: 'module-topology-unknown', message: 'Namespace re-exports require an explicit file/symbol reference.', path: record.path });
      continue;
    }
    if (ts.isExportAssignment(node)) {
      if (ts.isIdentifier(node.expression)) record.bindings.push({ local: node.expression.text, imported: node.expression.text, module: '', exported: 'default' });
      else record.diagnostics.push({ code: 'module-topology-unknown', message: 'Expression default export has no stable named declaration.', path: record.path });
      continue;
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) add(declaration.name.text, declaration, exported);
        else record.diagnostics.push({ code: 'code-inventory-unknown', message: 'Destructured top-level declarations need an explicit extraction adapter.', path: record.path });
      }
    } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
      if (!node.name) { record.diagnostics.push({ code: 'code-inventory-unknown', message: 'Anonymous default declaration has no named project symbol.', path: record.path }); continue; }
      const name = node.name.text; add(name, node, exported);
      if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        for (const member of node.members) {
          if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name))) {
            const privateMember = ts.canHaveModifiers(member) && ts.getModifiers(member)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword);
            add(member.name.text, member, exported && !privateMember, name);
          }
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)) record.diagnostics.push({ code: 'module-topology-unknown', message: 'Import-equals module topology is unsupported.', path: record.path });
    if (ts.isExpressionStatement(node) && /\b(?:module\.exports|exports[.[])/.test(node.getText(source))) record.diagnostics.push({ code: 'module-topology-unknown', message: 'CommonJS export assignments need an explicit language adapter.', path: record.path });
  }
  for (const binding of record.bindings.filter(binding => binding.exported && !binding.module)) {
    const target = symbols.get(binding.local); if (target) target.exported = true;
  }
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, record.source);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    for (const match of scanner.getTokenText().matchAll(/\[\[([^\]\n]+)\]\]/g)) record.references.push({ text: match[1]!, path: record.path, from: record.units[0]!.id, offset: scanner.getTokenPos() + match.index, kind: 'dependency' });
  }
}
