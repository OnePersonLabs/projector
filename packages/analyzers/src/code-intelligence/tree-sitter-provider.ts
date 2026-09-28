import {
  hashFramedDomain,
  type CodeInputBinding,
  type CodeLocation,
  type CodePartition,
  type CodeSnapshot,
  type CodeSymbol,
} from "@projector/core";
import { Parser, Language, type Node as SyntaxNode } from "web-tree-sitter";
import { getWasmPath, type SupportedLanguage } from "tree-sitter-wasm";
import { codeInputHash } from "./input-binding.js";

export interface TreeSitterCodeInput {
  readonly path: string;
  readonly content: string;
  readonly contentHash: string;
}
export interface TreeSitterCodeOptions {
  readonly binding: Omit<
    CodeInputBinding,
    "sourceInputs" | "configInputs" | "resolutionInputs" | "status"
  > & { readonly status?: CodeInputBinding["status"] };
}
const languageByExtension: Record<string, SupportedLanguage> = {
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  cs: "c_sharp",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  scala: "scala",
  sc: "scala",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "tsx",
};
const declarationKinds = new Set([
  "function_definition",
  "function_declaration",
  "function_item",
  "method_definition",
  "method_declaration",
  "class_definition",
  "class_declaration",
  "class_specifier",
  "struct_item",
  "struct_specifier",
  "interface_declaration",
  "trait_item",
  "type_declaration",
  "object_definition",
  "object_declaration",
  "enum_declaration",
  "enum_item",
]);
const provider = "projector.tree-sitter-syntax";

/** Syntax fallback deliberately reports no resolved cross-file reference or call edges. */
export class TreeSitterCodeProvider {
  private static initialization?: Promise<void>;
  private readonly grammars = new Map<SupportedLanguage, Language>();
  private readonly parsers = new Map<SupportedLanguage, Parser>();
  async update(
    inputs: readonly TreeSitterCodeInput[],
    options: TreeSitterCodeOptions,
    emitPartition?: (partition: CodePartition) => void,
  ): Promise<CodeSnapshot> {
    TreeSitterCodeProvider.initialization ??= Parser.init();
    await TreeSitterCodeProvider.initialization;
    const files = [...inputs]
      .filter(
        (file) =>
          languageByExtension[
            file.path.split(".").at(-1)?.toLowerCase() ?? ""
          ] !== undefined,
      )
      .sort((a, b) => a.path.localeCompare(b.path));
    const seen = new Set<string>();
    const partitions: CodePartition[] = [];
    for (const file of files) {
      if (
        !file.path ||
        file.path.startsWith("/") ||
        file.path.includes("\\") ||
        file.path.split("/").includes("..") ||
        seen.has(file.path)
      )
        throw new Error(
          `Invalid or duplicate syntax source path: ${file.path}`,
        );
      seen.add(file.path);
      const languageId =
        languageByExtension[file.path.split(".").at(-1)!.toLowerCase()]!;
      let grammar = this.grammars.get(languageId);
      if (grammar === undefined) {
        grammar = await Language.load(getWasmPath(languageId));
        this.grammars.set(languageId, grammar);
      }
      let parser = this.parsers.get(languageId);
      if (parser === undefined) {
        parser = new Parser();
        parser.setLanguage(grammar);
        this.parsers.set(languageId, parser);
      }
      const tree = parser.parse(file.content);
      if (tree === null)
        throw new Error(
          `Tree-sitter parser did not return a tree for ${file.path}`,
        );
      const provenance = {
        provider,
        version: "web-tree-sitter/0.27.0",
        inputHash: codeInputHash(file.content),
        artifact: `tree-sitter-wasm/2.0.2:${languageId}`,
      };
      const location = (node: SyntaxNode): CodeLocation => ({
        path: file.path,
        start: node.startIndex,
        end: node.endIndex,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      });
      const symbols: CodeSymbol[] = [];
      const walk = (node: SyntaxNode): void => {
        if (declarationKinds.has(node.type)) {
          const name =
            node.childForFieldName("name") ??
            node.childForFieldName("declarator");
          if (name !== null && name.text.length > 0) {
            const id = hashFramedDomain("projector-syntax-symbol-v1", {
              projectKey: options.binding.projectKey,
              path: file.path,
              start: name.startIndex,
              kind: node.type,
            });
            symbols.push({
              id,
              name: name.text,
              kind: node.type,
              definition: location(name),
              extent: location(node),
              declarationHash: hashFramedDomain(
                "projector-syntax-declaration-v1",
                node.text,
              ),
              provenance,
            });
          }
        }
        for (const child of node.namedChildren) walk(child);
      };
      walk(tree.rootNode);
      const capabilities = (
        [
          "definition",
          "reference",
          "import",
          "call",
          "type",
          "implementation",
        ] as const
      ).map((kind) => ({
        kind,
        fidelity: "syntax" as const,
        status:
          kind === "definition"
            ? ("partial" as const)
            : ("unavailable" as const),
        reason:
          kind === "definition"
            ? "Syntax declarations have no resolved identity"
            : "Syntax fallback does not resolve cross-file targets",
      }));
      const partition: CodePartition = {
        path: file.path,
        inputHash: codeInputHash(file.content),
        symbols,
        edges: [],
        coverage: {
          path: file.path,
          status: "partial",
          reason: tree.rootNode.hasError
            ? "Syntax tree contains parse errors; resolved relations unavailable"
            : "Syntax fallback cannot resolve relations",
          capabilities,
        },
      };
      if (emitPartition === undefined) partitions.push(partition);
      else emitPartition(partition);
      tree.delete();
    }
    const binding: CodeInputBinding = {
      ...options.binding,
      status: options.binding.status ?? "unbound",
      sourceInputs: files.map(({ path, content }) => ({
        path,
        contentHash: codeInputHash(content),
      })),
      configInputs: [],
      resolutionInputs: [],
    };
    return {
      schemaVersion: "projector.code-intelligence/v1",
      provider,
      providerVersion: "0.27.0",
      inputFingerprint: hashFramedDomain(
        "projector-syntax-input-v1",
        binding.sourceInputs,
      ),
      configFingerprint: hashFramedDomain(
        "projector-syntax-grammars-v1",
        files.map(
          (file) =>
            languageByExtension[file.path.split(".").at(-1)!.toLowerCase()],
        ),
      ),
      resolutionFingerprint: hashFramedDomain(
        "projector-syntax-resolution-v1",
        [],
      ),
      binding,
      partitions,
    };
  }
  close(): void {
    for (const parser of this.parsers.values()) parser.delete();
    this.parsers.clear();
    this.grammars.clear();
  }
}
