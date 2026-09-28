import { resolve, relative, isAbsolute, sep, posix } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
import {
  DEFAULT_OBSERVATION_LIMITS,
  hashFramedDomain,
  type CodeEdge,
  type CodeInputBinding,
  type CodeLocation,
  type CodePartition,
  type CodeProvenance,
  type CodeSnapshot,
  type CodeSymbol,
} from "@projector/core";
import { codeInputHash, verifyCodeInputBinding } from "./input-binding.js";

export interface TypeScriptCodeInput {
  readonly path: string;
  readonly content: string;
  readonly contentHash: string;
}
export interface TypeScriptCodeOptions {
  readonly repositoryRoot: string;
  readonly binding: Omit<
    CodeInputBinding,
    "sourceInputs" | "configInputs" | "resolutionInputs" | "status"
  >;
  readonly configPath?: string;
  readonly compilerOptions?: ts.CompilerOptions;
  readonly configFingerprint?: string;
  /** Maximum serialized input-binding proof bytes for this analysis. */
  readonly maxProofBytes?: number | null;
}
export function discoverTypeScriptProjects(
  inputs: readonly { readonly path: string; readonly content?: string }[],
): string[] {
  const candidates = inputs.filter((input) =>
    /(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]*)?\.json$/iu.test(input.path),
  );
  const known = new Set(candidates.map((input) => input.path));
  const inherited = new Set<string>(),
    referenced = new Set<string>();
  const ownsFiles = new Set<string>();
  const resolveConfig = (from: string, target: string): string | undefined => {
    const path = posix.normalize(posix.join(posix.dirname(from), target));
    return [path, `${path}.json`, `${path}/tsconfig.json`].find((candidate) =>
      known.has(candidate),
    );
  };
  for (const input of candidates) {
    if (input.content === undefined) continue;
    const parsed = ts.parseConfigFileTextToJson(input.path, input.content);
    if (parsed.error !== undefined)
      throw new Error(
        ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"),
      );
    const config = parsed.config as {
      extends?: string | string[];
      references?: { path: string }[];
      files?: unknown;
      include?: unknown;
    };
    if (config.files !== undefined || config.include !== undefined)
      ownsFiles.add(input.path);
    for (const parent of typeof config.extends === "string"
      ? [config.extends]
      : (config.extends ?? [])) {
      const path = resolveConfig(input.path, parent);
      if (path !== undefined) inherited.add(path);
    }
    for (const reference of config.references ?? []) {
      const path = resolveConfig(input.path, reference.path);
      if (path !== undefined) referenced.add(path);
    }
  }
  // An inherited options-only file is not another compilation of every source
  // below its directory. Explicit source sets and referenced projects remain.
  return candidates
    .map((input) => input.path)
    .filter(
      (path) =>
        !inherited.has(path) || referenced.has(path) || ownsFiles.has(path),
    )
    .sort();
}
const extensions = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/iu;
const provider = "projector.typescript-program";
const isIndexedDeclaration = (node: ts.Node): node is ts.Declaration =>
  ts.isVariableDeclaration(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isClassDeclaration(node) ||
  ts.isClassExpression(node) ||
  ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) ||
  ts.isEnumDeclaration(node) ||
  ts.isEnumMember(node) ||
  ts.isModuleDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isMethodSignature(node) ||
  ts.isPropertyDeclaration(node) ||
  ts.isPropertySignature(node) ||
  ts.isPropertyAssignment(node) ||
  ts.isShorthandPropertyAssignment(node) ||
  ts.isParameter(node) ||
  ts.isBindingElement(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ts.isTypeParameterDeclaration(node);

/** One instance owns its Program and TypeChecker for the resident service lifetime. */
export class TypeScriptCodeProvider {
  private program?: ts.Program;
  private fingerprint?: string;
  private snapshot?: CodeSnapshot;
  get currentProgram(): ts.Program | undefined {
    return this.program;
  }
  update(
    inputs: readonly TypeScriptCodeInput[],
    options: TypeScriptCodeOptions,
    sink?: {
      put(partition: CodePartition): void;
      get(path: string): CodePartition | undefined;
      replace(partition: CodePartition): void;
    },
  ): CodeSnapshot {
    const maxProofBytes =
      options.maxProofBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
    if (maxProofBytes !== null && (!Number.isSafeInteger(maxProofBytes) || maxProofBytes < 1))
      throw new RangeError("TypeScript maxProofBytes must be a positive safe integer");
    const assertProofBudget = (binding: CodeInputBinding): void => {
      const proofBytes = Buffer.byteLength(JSON.stringify(binding));
      if (maxProofBytes !== null && proofBytes > maxProofBytes)
        throw new Error(
          `TypeScript input binding requires ${proofBytes} bytes, exceeding maxProofBytes (${maxProofBytes}); increase the declared derived observation budget to retry`,
        );
    };
    if (!isAbsolute(options.repositoryRoot))
      throw new Error(
        "TypeScript code provider requires absolute repositoryRoot",
      );
    let files = [...inputs]
      .filter((input) => extensions.test(input.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    const seen = new Set<string>();
    for (const file of files) {
      if (
        !file.path ||
        file.path.startsWith("/") ||
        file.path.includes("\\") ||
        file.path.split("/").includes("..") ||
        seen.has(file.path)
      )
        throw new Error(
          `Invalid or duplicate TypeScript source path: ${file.path}`,
        );
      seen.add(file.path);
    }
    const configReads = new Map<string, string>();
    const configPath =
      options.configPath === undefined
        ? undefined
        : resolve(options.repositoryRoot, options.configPath);
    const configSystem: ts.ParseConfigHost = {
      ...ts.sys,
      readFile: (path) => {
        const value = ts.sys.readFile(path);
        if (value !== undefined)
          configReads.set(resolve(path), codeInputHash(value));
        return value;
      },
    };
    let parsedConfig: ts.ParsedCommandLine | undefined;
    if (configPath !== undefined) {
      const parsed = ts.readConfigFile(configPath, configSystem.readFile);
      if (parsed.error !== undefined)
        throw new Error(
          ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"),
        );
      parsedConfig = ts.parseJsonConfigFileContent(
        parsed.config,
        configSystem,
        resolve(configPath, ".."),
        undefined,
        configPath,
      );
      if (parsedConfig.errors.length > 0)
        throw new Error(
          parsedConfig.errors
            .map((error) =>
              ts.flattenDiagnosticMessageText(error.messageText, "\n"),
            )
            .join("\n"),
        );
      const members = new Set(
        parsedConfig.fileNames.map((path) => resolve(path)),
      );
      files = files.filter((file) =>
        members.has(resolve(options.repositoryRoot, file.path)),
      );
    }
    const compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      allowJs: true,
      checkJs: true,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2024,
      ...parsedConfig?.options,
      ...options.compilerOptions,
    };
    const configFingerprint =
      options.configFingerprint ??
      hashFramedDomain("projector-ts-options-v1", {
        compilerOptions,
        configReads: [...configReads],
      });
    const inputFingerprint = hashFramedDomain(
      "projector-ts-input-v1",
      files.map(({ path, content }) => ({
        path,
        contentHash: codeInputHash(content),
      })),
    );
    const cacheKey = hashFramedDomain("projector-ts-program-v1", {
      inputFingerprint,
      configFingerprint,
    });
    const sourceBytesMatch = files.every((file) => {
      try {
        return (
          readFileSync(resolve(options.repositoryRoot, file.path), "utf8") ===
          file.content
        );
      } catch {
        return false;
      }
    });
    if (
      sourceBytesMatch &&
      cacheKey === this.fingerprint &&
      sink === undefined &&
      this.snapshot !== undefined &&
      verifyCodeInputBinding(this.snapshot.binding, options.repositoryRoot)
    ) {
      assertProofBudget(this.snapshot.binding);
      return this.snapshot;
    }
    const content = new Map(
      files.map((file) => [resolve(options.repositoryRoot, file.path), file]),
    );
    const normalized = (name: string): string => resolve(name);
    const baseHost = ts.createCompilerHost(compilerOptions);
    const externalReads = new Map<string, string>();
    const externalProbes = new Map<string, boolean>();
    const directoryProbes = new Map<string, boolean>();
    const directoryListings = new Map<string, string[]>();
    const diskDirectoryExists = (name: string): boolean => {
      try {
        return statSync(name).isDirectory();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    };
    const diskDirectories = (name: string): string[] => {
      try {
        return readdirSync(name, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    };
    const fileExists = (name: string): boolean => {
      const path = normalized(name),
        exists = content.has(path) || baseHost.fileExists(name);
      if (!content.has(path)) externalProbes.set(path, exists);
      return exists;
    };
    const readFile = (name: string): string | undefined => {
      const internal = content.get(normalized(name));
      if (internal !== undefined) return internal.content;
      const value = baseHost.readFile(name);
      if (value !== undefined)
        externalReads.set(normalized(name), codeInputHash(value));
      return value;
    };
    const host: ts.CompilerHost = {
      ...baseHost,
      getCurrentDirectory: () => options.repositoryRoot,
      fileExists,
      readFile,
      getSourceFile: (name, languageVersion, onError) => {
        const data = readFile(name);
        if (data === undefined) {
          onError?.(`Missing source ${name}`);
          return undefined;
        }
        const scriptKind = /\.tsx$/iu.test(name)
          ? ts.ScriptKind.TSX
          : /\.jsx$/iu.test(name)
            ? ts.ScriptKind.JSX
            : /\.(?:js|mjs|cjs)$/iu.test(name)
              ? ts.ScriptKind.JS
              : ts.ScriptKind.TS;
        return ts.createSourceFile(
          name,
          data,
          languageVersion,
          true,
          scriptKind,
        );
      },
      writeFile: () => {
        throw new Error("Code intelligence must not emit compiler output");
      },
      directoryExists: (name) => {
        const directory = normalized(name),
          exists = diskDirectoryExists(directory);
        directoryProbes.set(directory, exists);
        return (
          [...content.keys()].some((path) =>
            path.startsWith(`${directory}${sep}`),
          ) || exists
        );
      },
      getDirectories: (name) => {
        const normalizedName = normalized(name),
          disk = diskDirectories(normalizedName);
        directoryListings.set(normalizedName, disk);
        const directory = new Set<string>(disk);
        for (const path of content.keys())
          if (path.startsWith(`${normalizedName}${sep}`)) {
            const remainder = path.slice(normalizedName.length + 1);
            if (remainder.includes(sep))
              directory.add(remainder.split(sep)[0]!);
          }
        return [...directory].sort();
      },
    };
    const program = ts.createProgram({
      rootNames: [...content.keys()],
      options: compilerOptions,
      host,
      ...(this.program === undefined ? {} : { oldProgram: this.program }),
    });
    const checker = program.getTypeChecker();
    const sourceFor = (source: ts.SourceFile): string | undefined =>
      content.get(normalized(source.fileName))?.path;
    const symbolId = (symbol: ts.Symbol | undefined): string | undefined => {
      if (symbol === undefined) return undefined;
      const actual =
        (symbol.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(symbol)
          : symbol;
      const declaration = actual.declarations?.find(
        (node) => sourceFor(node.getSourceFile()) !== undefined,
      );
      if (declaration === undefined) return undefined;
      const source = declaration.getSourceFile(),
        path = sourceFor(source)!;
      return hashFramedDomain("projector-code-symbol-v1", {
        projectKey: options.binding.projectKey,
        path,
        start: declaration.getStart(source),
        name: actual.getName(),
      });
    };
    const resolutions: {
      importer: string;
      specifier: string;
      resolved?: string;
    }[] = [];
    const partitions: CodePartition[] = [];
    for (const file of files) {
      const partition = (() : CodePartition => {
      const source = program.getSourceFile(
        resolve(options.repositoryRoot, file.path),
      );
      if (source === undefined)
        throw new Error(`Compiler omitted source ${file.path}`);
      const provenance: CodeProvenance = {
        provider,
        version: ts.version,
        inputHash: codeInputHash(file.content),
      };
      const symbols: CodeSymbol[] = [],
        edges: CodeEdge[] = [];
      let ownerSymbolId: string | undefined;
      const locate = (node: ts.Node): CodeLocation => {
        const start = node.getStart(source),
          point = source.getLineAndCharacterOfPosition(start);
        return {
          path: file.path,
          start,
          end: node.getEnd(),
          line: point.line + 1,
          column: point.character + 1,
        };
      };
      const addEdge = (
        kind: CodeEdge["kind"],
        node: ts.Node,
        resolved: string | undefined,
        targetPath?: string,
        unknown = false,
      ): void => {
        const location = locate(node),
          resolution =
            resolved === undefined && targetPath === undefined
              ? unknown
                ? "unknown"
                : "unresolved"
              : "resolved";
        edges.push({
          id: hashFramedDomain("projector-code-edge-v1", {
            kind,
            location,
            resolved,
            targetPath,
          }),
          kind,
          source: location,
          ...(ownerSymbolId === undefined
            ? {}
            : { sourceSymbolId: ownerSymbolId }),
          ...(resolved === undefined ? {} : { targetSymbolId: resolved }),
          ...(targetPath === undefined ? {} : { targetPath }),
          resolution,
          provenance,
        });
      };
      const visit = (node: ts.Node): void => {
        const previousOwner = ownerSymbolId;
        if (
          isIndexedDeclaration(node) &&
          "name" in node &&
          node.name &&
          (ts.isIdentifier(node.name as ts.Node) ||
            ts.isStringLiteral(node.name as ts.Node) ||
            ts.isNumericLiteral(node.name as ts.Node))
        ) {
          const name = node.name as
              | ts.Identifier
              | ts.StringLiteral
              | ts.NumericLiteral,
            symbol = checker.getSymbolAtLocation(name),
            id = symbolId(symbol);
          if (id !== undefined && symbol?.declarations?.includes(node))
            ownerSymbolId = id;
          if (
            id !== undefined &&
            symbol?.declarations?.[0] === (node as ts.Node)
          ) {
            const kind = ts.SyntaxKind[node.kind] ?? String(node.kind),
              definition = locate(name),
              extent = locate(node);
            const body =
              "body" in node &&
              node.body &&
              typeof node.body === "object" &&
              "getText" in node.body
                ? (node.body as ts.Node)
                : undefined;
            const implementationBody = symbol.declarations?.find(
              (declaration) =>
                sourceFor(declaration.getSourceFile()) !== undefined &&
                "body" in declaration &&
                declaration.body !== undefined,
            );
            const bodyForHash =
              body ??
              (implementationBody !== undefined &&
              "body" in implementationBody
                ? (implementationBody.body as ts.Node)
                : undefined);
            const surfaces = (symbol.declarations ?? [])
              .filter(
                (declaration) =>
                  sourceFor(declaration.getSourceFile()) !== undefined,
              )
              .map((declaration) => {
                const declarationSource = declaration.getSourceFile();
                const text = declaration.getText(declarationSource);
                const implementation =
                  "body" in declaration && declaration.body !== undefined
                    ? (declaration.body as ts.Node)
                    : undefined;
                const surface =
                  implementation === undefined
                    ? text
                    : text.slice(
                        0,
                        implementation.getStart(declarationSource) -
                          declaration.getStart(declarationSource),
                      ) +
                      text.slice(
                        implementation.getEnd() -
                          declaration.getStart(declarationSource),
                      );
                return {
                  path: sourceFor(declarationSource)!,
                  start: declaration.getStart(declarationSource),
                  kind: ts.SyntaxKind[declaration.kind],
                  surface,
                };
              })
              .sort((a, b) =>
                a.path.localeCompare(b.path) || a.start - b.start,
              );
            const typeSurface = checker.typeToString(
              checker.getTypeAtLocation(name),
              node,
              // Keep recursive inferred types bounded in this display string.
              // Compiler symbols and relationships are collected independently.
              ts.TypeFormatFlags.None,
            );
            const declarationHash = hashFramedDomain(
              "projector-code-declaration-v1",
              {
                kind,
                surfaces,
                typeSurface,
              },
            );
            const bodyText =
              bodyForHash?.getText() ??
              (ts.isClassDeclaration(node)
                ? node.members
                    .map((member) =>
                      "body" in member && member.body
                        ? (member.body as ts.Node).getText(source)
                        : "",
                    )
                    .join("\n")
                : undefined);
            symbols.push({
              id,
              name: name.text,
              kind,
              definition,
              extent,
              typeDisplay: typeSurface,
              declarationHash,
              ...(bodyText === undefined
                ? {}
                : {
                    bodyHash: hashFramedDomain(
                      "projector-code-body-v1",
                      bodyText,
                    ),
                  }),
              provenance,
            });
          }
        }
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const resolved = ts.resolveModuleName(
            node.moduleSpecifier.text,
            source.fileName,
            compilerOptions,
            host,
          ).resolvedModule;
          const resolvedSource =
            resolved === undefined
              ? undefined
              : program.getSourceFile(resolved.resolvedFileName);
          const target =
            resolvedSource === undefined
              ? undefined
              : sourceFor(resolvedSource);
          resolutions.push({
            importer: file.path,
            specifier: node.moduleSpecifier.text,
            ...(target === undefined ? {} : { resolved: target }),
          });
          addEdge("import", node.moduleSpecifier, undefined, target);
        }
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          const target = checker.getResolvedSignature(node)?.declaration;
          addEdge(
            "call",
            node.expression,
            target === undefined
              ? undefined
              : symbolId(
                  checker.getSymbolAtLocation(
                    (target as ts.NamedDeclaration).name ?? target,
                  ),
                ),
          );
        }
        if (ts.isHeritageClause(node))
          for (const type of node.types)
            addEdge(
              node.token === ts.SyntaxKind.ImplementsKeyword
                ? "implementation"
                : "type",
              type.expression,
              symbolId(checker.getSymbolAtLocation(type.expression)),
            );
        if (ts.isTypeReferenceNode(node))
          addEdge(
            "type",
            node.typeName,
            symbolId(checker.getSymbolAtLocation(node.typeName)),
          );
        if (
          ts.isIdentifier(node) &&
          !(isIndexedDeclaration(node.parent) && "name" in node.parent && node.parent.name === node) &&
          !ts.isImportSpecifier(node.parent) &&
          !ts.isExportSpecifier(node.parent)
        ) {
          const symbol = checker.getSymbolAtLocation(node),
            target = symbolId(symbol);
          if (target !== undefined) addEdge("reference", node, target);
          else if (symbol !== undefined) {
            const actual =
              (symbol.flags & ts.SymbolFlags.Alias) !== 0
                ? checker.getAliasedSymbol(symbol)
                : symbol;
            if (
              actual.declarations?.some(
                (declaration) =>
                  sourceFor(declaration.getSourceFile()) === undefined,
              )
            )
              addEdge("reference", node, undefined, undefined, true);
          }
        }
        ts.forEachChild(node, visit);
        ownerSymbolId = previousOwner;
      };
      visit(source);
      const unknown =
        edges.some((edge) => edge.resolution !== "resolved") ||
        (parsedConfig?.projectReferences?.length ?? 0) > 0;
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
        fidelity: "semantic" as const,
        status: unknown ? ("partial" as const) : ("available" as const),
      }));
      return {
        path: file.path,
        inputHash: codeInputHash(file.content),
        symbols,
        edges,
        coverage: {
          path: file.path,
          status: unknown ? "partial" : "complete",
          ...(unknown
            ? {
                reason:
                  "Some static targets or project references are outside the supplied source closure",
              }
            : {}),
          capabilities,
        },
      };
      })();
      if (sink === undefined) partitions.push(partition);
      else sink.put(partition);
    }
    const indexedSymbols = new Set<string>();
    for (let index = 0; index < files.length; index++) {
      const file = files[index]!;
      const partition = sink === undefined ? partitions[index] : sink.get(file.path);
      if (partition === undefined) throw new Error(`Missing staged TypeScript partition: ${file.path}`);
      for (const symbol of partition.symbols) indexedSymbols.add(symbol.id);
    }
    for (let index = 0; index < files.length; index++) {
      const partition = sink === undefined ? partitions[index]! : sink.get(files[index]!.path)!;
      let missingLocalDefinition = false;
      const edges = partition.edges.map((edge): CodeEdge => {
        if (
          edge.targetSymbolId === undefined ||
          edge.targetPath !== undefined ||
          indexedSymbols.has(edge.targetSymbolId)
        )
          return edge;
        missingLocalDefinition = true;
        const { targetSymbolId: _targetSymbolId, ...withoutTarget } = edge;
        return {
          ...withoutTarget,
          id: hashFramedDomain("projector-code-edge-v1", {
            kind: edge.kind,
            location: edge.source,
            resolved: undefined,
            targetPath: undefined,
          }),
          resolution: "unknown",
        };
      });
      if (!missingLocalDefinition) continue;
      const reason = "Some local semantic targets have no indexed definition";
      const revised: CodePartition = {
        ...partition,
        edges,
        coverage: {
          ...partition.coverage,
          status: "partial",
          reason: partition.coverage.reason
            ? `${partition.coverage.reason}; ${reason}`
            : reason,
          capabilities: partition.coverage.capabilities.map((capability) => ({
            ...capability,
            status: "partial",
          })),
        },
      };
      if (sink === undefined) partitions[index] = revised;
      else sink.replace(revised);
    }
    const resolutionFingerprint = hashFramedDomain(
      "projector-ts-resolution-v1",
      {
        resolutions: resolutions.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        ),
        externalReads: [...externalReads].sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      },
    );
    const bindingPath = (path: string): string =>
      relative(options.repositoryRoot, path).replaceAll("\\", "/") || ".";
    const binding: CodeInputBinding = {
      ...options.binding,
      status: sourceBytesMatch ? "verified" : "unbound",
      sourceInputs: files.map(({ path, content }) => ({
        path,
        contentHash: codeInputHash(content),
      })),
      configInputs: [...configReads]
        .map(([path, contentHash]) => ({
          path: bindingPath(path),
          contentHash,
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      resolutionInputs: [...externalReads]
        .map(([path, contentHash]) => ({
          path: bindingPath(path),
          contentHash,
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      resolutionProbes: [...externalProbes]
        .map(([path, exists]) => ({ path: bindingPath(path), exists }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      directoryProbes: [...directoryProbes]
        .map(([path, exists]) => ({ path: bindingPath(path), exists }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      directoryListings: [...directoryListings]
        .map(([path, directories]) => ({
          path: bindingPath(path),
          directories,
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    };
    assertProofBudget(binding);
    const snapshot: CodeSnapshot = {
      schemaVersion: "projector.code-intelligence/v1",
      provider,
      providerVersion: ts.version,
      inputFingerprint,
      configFingerprint,
      resolutionFingerprint,
      binding,
      partitions,
    };
    this.program = program;
    this.fingerprint = cacheKey;
    if (sink === undefined) this.snapshot = snapshot;
    else delete this.snapshot;
    return snapshot;
  }
}
