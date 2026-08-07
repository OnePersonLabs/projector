import { readFile } from "node:fs/promises";
import ts from "typescript";

const sourcePath = new URL("../packages/core/src/domain/contracts.ts", import.meta.url);
const sourceText = await readFile(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath.pathname, sourceText, ts.ScriptTarget.Latest, true);

const declarations = new Map();
for (const statement of source.statements) {
  if ((ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name) {
    declarations.set(statement.name.text, statement);
  }
}

const runtimeOnly = new Set([
  "AdapterContext",
  "GraphReader",
  "ModelProvider",
  "StateBindingValidator",
  "StateQueryReader",
  "SurfaceAdapter",
  "TokenCounter",
  "Transform",
  "TransformContext",
]);
const manual = new Set(["EntityId", "Confidence", "ContentHash", "SourceClass"]);

function text(node) {
  return node.getText(source);
}

function declaration(name) {
  const found = declarations.get(name);
  if (!found) throw new Error(`unknown contract reference ${name}`);
  return found;
}

function propertyType(typeName, propertyName) {
  const target = declaration(typeName);
  if (!ts.isInterfaceDeclaration(target)) {
    throw new Error(`indexed access target ${typeName} is not an interface`);
  }
  const property = target.members.find(
    (member) => ts.isPropertySignature(member) && member.name && text(member.name).replaceAll('"', "") === propertyName,
  );
  if (!property?.type) throw new Error(`missing ${typeName}.${propertyName}`);
  return property.type;
}

function typeExpression(node, genericNames = new Set()) {
  if (node.kind === ts.SyntaxKind.StringKeyword) return "z.string()";
  if (node.kind === ts.SyntaxKind.NumberKeyword) return "z.number().finite()";
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return "z.boolean()";
  if (node.kind === ts.SyntaxKind.UnknownKeyword || node.kind === ts.SyntaxKind.AnyKeyword) return "JsonValueSchema";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "z.null()";
  if (ts.isLiteralTypeNode(node)) {
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return "z.literal(true)";
    if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return "z.literal(false)";
    if (ts.isStringLiteral(node.literal) || ts.isNumericLiteral(node.literal)) {
      return `z.literal(${JSON.stringify(node.literal.text)})`;
    }
  }
  if (ts.isUnionTypeNode(node)) {
    return `z.union([${node.types.map((part) => typeExpression(part, genericNames)).join(", ")}])`;
  }
  if (ts.isArrayTypeNode(node)) return `z.array(${typeExpression(node.elementType, genericNames)})`;
  if (ts.isParenthesizedTypeNode(node)) return typeExpression(node.type, genericNames);
  if (ts.isTypeLiteralNode(node)) return objectExpression(node.members, genericNames);
  if (ts.isIndexedAccessTypeNode(node)) {
    if (!ts.isTypeReferenceNode(node.objectType) || !ts.isIdentifier(node.objectType.typeName)) {
      throw new Error(`unsupported indexed access ${text(node)}`);
    }
    if (!ts.isLiteralTypeNode(node.indexType) || !ts.isStringLiteral(node.indexType.literal)) {
      throw new Error(`unsupported index ${text(node)}`);
    }
    return typeExpression(propertyType(node.objectType.typeName.text, node.indexType.literal.text), genericNames);
  }
  if (ts.isTemplateLiteralTypeNode(node)) return "z.string()";
  if (ts.isTypeReferenceNode(node)) {
    const name = text(node.typeName);
    const args = node.typeArguments ?? [];
    if (genericNames.has(name)) return "JsonValueSchema";
    if (name === "Array") return `z.array(${typeExpression(args[0], genericNames)})`;
    if (name === "Record") {
      return `z.record(${typeExpression(args[0], genericNames)}, ${typeExpression(args[1], genericNames)})`;
    }
    if (name === "Partial") {
      const inner = args[0];
      if (ts.isTypeReferenceNode(inner) && text(inner.typeName) === "Record") {
        const [key, value] = inner.typeArguments ?? [];
        const keyExpression = ts.isTypeReferenceNode(key) && ts.isIdentifier(key.typeName)
          ? schemaExpression(declaration(key.typeName.text))
          : typeExpression(key, genericNames);
        return `z.partialRecord(${keyExpression}, ${typeExpression(value, genericNames)})`;
      }
      return `${typeExpression(inner, genericNames)}.partial()`;
    }
    return `${name}Schema`;
  }
  throw new Error(`unsupported type node ${ts.SyntaxKind[node.kind]}: ${text(node)}`);
}

function allMembers(node) {
  const inherited = [];
  for (const clause of node.heritageClauses ?? []) {
    for (const type of clause.types) {
      const base = declaration(text(type.expression));
      if (!ts.isInterfaceDeclaration(base)) throw new Error(`unsupported base ${text(type.expression)}`);
      inherited.push(...allMembers(base));
    }
  }
  return [...inherited, ...node.members];
}

function objectExpression(members, genericNames = new Set()) {
  const properties = [];
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.type || !member.name) continue;
    const name = text(member.name).replaceAll('"', "");
    const schema = typeExpression(member.type, genericNames);
    properties.push(`  ${JSON.stringify(name)}: ${schema}${member.questionToken ? ".optional()" : ""}`);
  }
  return `strictObject({\n${properties.join(",\n")}\n})`;
}

function schemaExpression(node) {
  const genericNames = new Set((node.typeParameters ?? []).map((parameter) => parameter.name.text));
  if (ts.isInterfaceDeclaration(node)) return objectExpression(allMembers(node), genericNames);
  return typeExpression(node.type, genericNames);
}

function enhancedSchemaExpression(name, node) {
  const base = schemaExpression(node);
  if (name === "RequirementDelta" || name === "BehavioralScenarioDelta") {
    const idField = name === "RequirementDelta" ? "requirementId" : "scenarioId";
    const proposedField = name === "RequirementDelta" ? "proposedRequirement" : "proposedScenario";
    return `${base}.superRefine((value, context) => {
  const needsExistingId = value.kind !== "add";
  const needsProposedValue = value.kind !== "remove";
  if (needsExistingId !== (value.${idField} !== undefined)) context.addIssue({ code: "custom", path: ["${idField}"], message: needsExistingId ? "existing ID is required" : "add cannot name an existing ID" });
  if (needsProposedValue !== (value.${proposedField} !== undefined)) context.addIssue({ code: "custom", path: ["${proposedField}"], message: needsProposedValue ? "proposed value is required" : "remove cannot carry a proposed value" });
})`;
  }
  if (name === "LineageRecord") {
    return `${base}.superRefine((value, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (new Set(value.fromIds).size !== value.fromIds.length || new Set(value.toIds).size !== value.toIds.length) issue("lineage endpoints must be unique");
  if (value.fromIds.length === 0) issue("lineage requires at least one source");
  if (value.kind === "move" && (value.fromIds.length !== 1 || value.toIds.length !== 1)) issue("move lineage requires exactly one source and destination");
  if (value.kind === "split" && value.toIds.length < 2) issue("split lineage requires at least two destinations");
  if (value.kind === "merge" && (value.fromIds.length < 2 || value.toIds.length !== 1)) issue("merge lineage requires at least two sources and one destination");
  if (value.kind === "replace" && value.toIds.length === 0) issue("replace lineage requires at least one destination");
  if (value.kind === "delete" && value.toIds.length !== 0) issue("delete lineage cannot have destinations");
})`;
  }
  return base;
}

const lines = [
  "// Generated by scripts/generate-contract-schemas.mjs from domain/contracts.ts.",
  'import { z } from "zod";',
  'import { ConfidenceSchema, ContentHashSchema, EntityIdSchema, SourceClassSchema } from "./contracts.js";',
  "",
  "export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>",
  "  z.union([z.null(), z.boolean(), z.number().finite(), z.string(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),",
  ");",
  "const strictObject = <T extends z.core.$ZodLooseShape>(shape: T) => z.strictObject(shape);",
  "",
];

for (const [name, node] of declarations) {
  if (runtimeOnly.has(name) || manual.has(name)) continue;
  lines.push(
    `export const ${name}Schema: z.ZodType = z.lazy(() => ${enhancedSchemaExpression(name, node)});`,
    "",
  );
}

while (lines.at(-1) === "") lines.pop();
process.stdout.write(`${lines.join("\n")}\n`);
