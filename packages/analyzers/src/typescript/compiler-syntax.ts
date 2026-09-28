import ts from "typescript";
import { DerivedObservationBudget, hashFramedDomain } from "@projector/core";
import type { ExportFact, ImportBindingFact, SemanticDeclarationFact, SourceLocationFact } from "./facts.js";
import { compareCodePoint } from "../ordering.js";

export const syntaxProgramVersion = `typescript-syntax-1.${ts.version}`;
export interface StaticModuleSyntax { readonly specifier: string; readonly bindings: ImportBindingFact[]; readonly typeOnly: boolean }
export interface EventCallSyntax { readonly receiver: string; readonly operation: string; readonly name?: string; readonly location: SourceLocationFact }

/** Parse source as data. The compiler host has no filesystem, resolution, emit, or execution lane. */
export function analyzeCompilerSyntax(content: string, path: string, scopeKey: string, budget: DerivedObservationBudget) {
  const scratch = 1024 + content.length * 16;
  budget.reserve(scratch, "typescript-syntax-tree", path);
  try {
    const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : path.endsWith(".jsx") ? ts.ScriptKind.JSX
      : /\.(?:mjs|cjs|js)$/u.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind);
    const host: ts.CompilerHost = {
      getSourceFile: name => name === path ? source : undefined,
      getDefaultLibFileName: () => "", writeFile: () => { throw new Error("Static syntax observation cannot emit files"); },
      getCurrentDirectory: () => "/", getDirectories: () => [], getCanonicalFileName: name => name,
      useCaseSensitiveFileNames: () => true, getNewLine: () => "\n", fileExists: name => name === path,
      readFile: name => name === path ? content : undefined,
    };
    const program = ts.createProgram([path], { noLib: true, noResolve: true, noEmit: true, allowJs: true, jsx: ts.JsxEmit.Preserve }, host);
    const diagnostics = program.getSyntacticDiagnostics(source).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
    const imports: StaticModuleSyntax[] = [], declarations: SemanticDeclarationFact[] = [], exportFacts: ExportFact[] = [];
    const eventCalls: EventCallSyntax[] = [], testNames = new Set<string>(), unknowns = new Set<string>();
    const location = (node: ts.Node): SourceLocationFact => {
      const offset = node.getStart(source), point = source.getLineAndCharacterOfPosition(offset);
      return { line: point.line + 1, column: point.character + 1, offset, endOffset: node.getEnd() };
    };
    const modifiers = (node: ts.Node) => ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
    const modified = (node: ts.Node, kind: ts.SyntaxKind) => modifiers(node).some(modifier => modifier.kind === kind);
    const bindingNames = (name: ts.BindingName): string[] => ts.isIdentifier(name) ? [name.text]
      : name.elements.flatMap(element => ts.isOmittedExpression(element) ? [] : bindingNames(element.name));
    const declare = (node: ts.Node, name: string, kind: SemanticDeclarationFact["kind"], owner = node) => {
      const semantic = { scopeKey, name, kind, exported: modified(owner, ts.SyntaxKind.ExportKeyword), default: modified(owner, ts.SyntaxKind.DefaultKeyword), overload: ts.isFunctionDeclaration(node) && node.body === undefined };
      budget.reserve(640 + 2 * (scopeKey.length + name.length), "javascript-declarations", path);
      declarations.push({ id: `ts_decl_${hashFramedDomain("typescript-semantic-declaration-identity", { scopeKey, name, kind }).slice(-32)}`, ...semantic,
        location: location(owner), semanticHash: hashFramedDomain("typescript-semantic-declaration", semantic) });
    };
    const module = (specifier: string, bindings: ImportBindingFact[], typeOnly: boolean) => {
      budget.reserve(192 + 2 * specifier.length + bindings.reduce((size, binding) => size + 160 + 2 * (binding.imported.length + binding.local.length), 0), "javascript-imports", path);
      imports.push({ specifier, bindings: bindings.sort((a, b) => compareCodePoint(a.imported, b.imported) || compareCodePoint(a.local, b.local)), typeOnly });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause, typeOnly = clause?.isTypeOnly ?? false, bindings: ImportBindingFact[] = [];
        if (clause?.name) bindings.push({ imported: "default", local: clause.name.text, typeOnly });
        const named = clause?.namedBindings;
        if (named && ts.isNamespaceImport(named)) bindings.push({ imported: "*", local: named.name.text, typeOnly });
        if (named && ts.isNamedImports(named)) for (const element of named.elements) bindings.push({ imported: (element.propertyName ?? element.name).text, local: element.name.text, typeOnly: typeOnly || element.isTypeOnly });
        module(node.moduleSpecifier.text, bindings, typeOnly);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
        module(node.moduleReference.expression.text, [{ imported: "*", local: node.name.text, typeOnly: node.isTypeOnly }], node.isTypeOnly);
      } else if (ts.isExportDeclaration(node)) {
        const from = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
        const bindings: ImportBindingFact[] = [];
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const typeOnly = node.isTypeOnly || element.isTypeOnly, imported = (element.propertyName ?? element.name).text;
            bindings.push({ imported, local: element.name.text, typeOnly });
            exportFacts.push({ exportedName: element.name.text, localName: imported, ...(from === undefined ? {} : { from }), typeOnly, default: element.name.text === "default", wildcard: false, location: location(node) });
          }
        } else {
          const exportedName = node.exportClause && ts.isNamespaceExport(node.exportClause) ? node.exportClause.name.text : undefined;
          bindings.push({ imported: "*", local: exportedName ?? "*", typeOnly: node.isTypeOnly });
          exportFacts.push({ ...(exportedName === undefined ? {} : { exportedName }), ...(from === undefined ? {} : { from }), typeOnly: node.isTypeOnly, default: false, wildcard: true, location: location(node) });
        }
        if (from !== undefined) module(from, bindings, node.isTypeOnly);
      } else if (ts.isExportAssignment(node)) {
        exportFacts.push({ exportedName: node.isExportEquals ? "export=" : "default", typeOnly: false, default: !node.isExportEquals, wildcard: false, location: location(node) });
      }
      if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) for (const name of bindingNames(declaration.name)) declare(declaration, name, "variable", node);
      else if (ts.isFunctionDeclaration(node) && node.name) declare(node, node.name.text, "function");
      else if (ts.isClassDeclaration(node) && node.name) declare(node, node.name.text, "class");
      else if (ts.isInterfaceDeclaration(node)) declare(node, node.name.text, "interface");
      else if (ts.isTypeAliasDeclaration(node)) declare(node, node.name.text, "type");
      else if (ts.isEnumDeclaration(node)) declare(node, node.name.text, "enum");
      else if (ts.isModuleDeclaration(node)) declare(node, node.name.text, "namespace");
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) unknowns.add("dynamic import cannot prove a static dependency");
        if (ts.isIdentifier(node.expression) && node.expression.text === "require") unknowns.add("runtime require binding is outside static module resolution");
        const argument = node.arguments[0];
        if (ts.isIdentifier(node.expression) && ["test", "it"].includes(node.expression.text) && argument && ts.isStringLiteral(argument)) testNames.add(argument.text);
        if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
          const operation = node.expression.name.text;
          if (["emit", "publish", "dispatchEvent", "on", "addEventListener", "subscribe"].includes(operation)) {
            eventCalls.push({ receiver: node.expression.expression.text, operation, ...(argument && ts.isStringLiteral(argument) ? { name: argument.text } : {}), location: location(argument ?? node) });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    // Recovery nodes from invalid source are not proof of a complete static population.
    if (diagnostics.length === 0) visit(source);
    else for (const diagnostic of diagnostics) unknowns.add(`syntax observation incomplete: ${diagnostic}`);
    for (const declaration of declarations) if (declaration.exported) exportFacts.push({ exportedName: declaration.default ? "default" : declaration.name, localName: declaration.name, typeOnly: ["type", "interface"].includes(declaration.kind), default: declaration.default, wildcard: false, location: declaration.location });
    budget.reserveItems(exportFacts.length, 256, "javascript-export-facts", path);
    budget.reserveItems(testNames.size, 128, "javascript-tests", path);
    budget.reserveItems(eventCalls.length, 256, "javascript-event-syntax", path);
    budget.reserveItems(unknowns.size, 256, "javascript-syntax-unknowns", path);
    return { imports, declarations: declarations.sort((a, b) => compareCodePoint(a.id, b.id) || a.location.offset - b.location.offset),
      exportFacts: exportFacts.sort((a, b) => compareCodePoint(a.exportedName ?? "*", b.exportedName ?? "*") || a.location.offset - b.location.offset),
      exports: [...new Set(exportFacts.filter(fact => !fact.typeOnly && fact.exportedName !== undefined).map(fact => fact.exportedName!))].sort(compareCodePoint),
      eventCalls, testNames: [...testNames].sort(compareCodePoint), unknowns: [...unknowns].sort(compareCodePoint), diagnostics };
  } finally { budget.release(scratch); }
}
