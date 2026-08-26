import {
  authorizeRepositoryPath,
  hashFramedDomain,
  type CompiledWriteAuthorization,
  type EntityId,
  type OperationEvidence,
  type Transform,
  type TransformContext,
  type TransformPreview,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";

import { TransformPreconditionError, TransformScopeError, type TransformMutationPort } from "./contracts.js";

export interface ExactTextEdit {
  readonly unitId: EntityId;
  readonly path: string;
  /** `null` means the path must not exist. */
  readonly before: string | null;
  /** `null` means delete the existing file. */
  readonly after: string | null;
}

export interface ExactTextPatchInput {
  readonly edits: readonly ExactTextEdit[];
}

export interface ExactTextPatchTransformOptions {
  readonly now?: () => string;
}

interface PreparedEdit extends ExactTextEdit {
  readonly beforeHash: ReturnType<typeof contentHash>;
  readonly afterHash: ReturnType<typeof contentHash>;
}

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const contentHash = (content: string | null) => hashFramedDomain("transform-content", content);

function canonicalPath(path: string): boolean {
  return path.length > 0
    && path === path.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/").replace(/\/$/u, "")
    && !path.startsWith("/")
    && !/^[A-Za-z]:/u.test(path)
    && !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function pathMatchesBoundary(path: string, boundary: readonly string[]): boolean {
  return boundary.some((pattern) => {
    if (pattern === "**" || pattern === ".") return true;
    if (pattern.endsWith("/**")) {
      const root = pattern.slice(0, -3).replace(/\/$/u, "");
      return path === root || path.startsWith(`${root}/`);
    }
    return path === pattern;
  });
}

export class ExactTextPatchTransform implements Transform<ExactTextPatchInput> {
  readonly id = "exact-text-patch";
  readonly version = "1";
  readonly description = "Create, replace, or delete UTF-8 files with exact before-content preconditions";

  private readonly now: () => string;
  private readonly appliedInputs = new WeakMap<TransformResult, ExactTextPatchInput>();

  constructor(
    private readonly mutation: TransformMutationPort,
    options: ExactTextPatchTransformOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async applies(input: ExactTextPatchInput, context: TransformContext): Promise<boolean> {
    return (await this.prepare(input, context, "before")).length > 0;
  }

  async preview(input: ExactTextPatchInput, context: TransformContext): Promise<TransformPreview> {
    const edits = await this.prepare(input, context, "before");
    return {
      applicable: edits.length > 0,
      operations: edits.map(({ unitId, path, beforeHash, afterHash, after }) => ({
        kind: after === null ? "delete-file" : "write-file",
        unitId,
        path,
        beforeHash,
        afterHash,
        provenance: "source" as const,
      })),
      touchedUnitIds: unique(edits.map(({ unitId }) => unitId)),
      expectedDiff: edits.map(({ path, before, after }) => before === null
        ? `create ${path}`
        : after === null ? `delete ${path}` : `replace ${path}`).join("\n"),
      warnings: [],
    };
  }

  async apply(input: ExactTextPatchInput, context: TransformContext): Promise<TransformResult> {
    const edits = await this.prepare(input, context, "before");
    if (context.dryRun || edits.length === 0) {
      return { transformId: this.id, changed: false, touchedUnitIds: [], operations: [] };
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:before`);
    const evidence: OperationEvidence[] = [];
    try {
      for (const [index, edit] of edits.entries()) {
        if (context.signal.aborted) throw new Error("transform aborted");
        if (edit.after === null) await this.mutation.deleteFile(edit.path);
        else await this.mutation.writeFile(edit.path, edit.after);
        evidence.push({
          operationId: `${this.id}:${index + 1}`,
          executor: "transform",
          unitIds: [edit.unitId],
          beforeHashes: [edit.beforeHash],
          afterHashes: [edit.afterHash],
          evidenceIds: [],
          summary: edit.after === null ? `deleted ${edit.path}` : edit.before === null ? `created ${edit.path}` : `replaced ${edit.path}`,
        });
      }
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("exact text patch failed");
      const partial = error as Error & { partialResult?: TransformResult };
      partial.partialResult ??= {
        transformId: this.id,
        changed: evidence.length > 0,
        touchedUnitIds: unique(evidence.flatMap(({ unitIds }) => unitIds)),
        operations: evidence,
        checkpointId: `${this.id}@${this.version}:before`,
      };
      throw partial;
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:after`);
    const result: TransformResult = {
      transformId: this.id,
      changed: true,
      touchedUnitIds: unique(edits.map(({ unitId }) => unitId)),
      operations: evidence,
      checkpointId: `${this.id}@${this.version}:after`,
    };
    this.appliedInputs.set(result, structuredClone(input));
    return result;
  }

  async verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]> {
    const startedAt = this.now();
    const violations: string[] = [];
    const input = this.appliedInputs.get(result);
    if (result.changed && input === undefined) {
      violations.push("transform result is not associated with this transform execution");
    } else if (input !== undefined) {
      try { await this.prepare(input, context, "after"); }
      catch (error) { violations.push(error instanceof Error ? error.message : "postcondition verification failed"); }
    }
    if (context.signal.aborted) violations.push("verification aborted");
    return [{
      validatorId: `${this.id}.verify`,
      status: violations.length === 0 ? "passed" : "blocked",
      summary: violations.length === 0 ? "exact text patch postconditions verified" : violations.join("; "),
      evidenceIds: [],
      evidenceLane: "runtime",
      independenceGroup: "deterministic-transform",
      assurance: "exact",
      authorSource: `${this.id}@${this.version}`,
      sideEffectClass: "none",
      details: { violations },
      startedAt,
      completedAt: this.now(),
    }];
  }

  private async prepare(
    input: ExactTextPatchInput,
    context: TransformContext,
    expectedSide: "before" | "after",
  ): Promise<PreparedEdit[]> {
    const approvedBoundary = (context as TransformContext & { approvedBoundary?: readonly string[] }).approvedBoundary;
    const authorization = (context as TransformContext & { writeAuthorization?: CompiledWriteAuthorization }).writeAuthorization;
    if (approvedBoundary === undefined || approvedBoundary.length === 0) throw new TransformScopeError("transform context has no approved path boundary");
    if (authorization === undefined) throw new TransformScopeError("transform context has no compiled write authorization");
    if (input.edits.length === 0) throw new TransformPreconditionError("exact text patch requires at least one edit");
    const allowedUnits = new Set(context.allowedUnits);
    const paths = new Set<string>();
    const prepared: PreparedEdit[] = [];
    for (const edit of [...input.edits].sort((left, right) => compare(left.path, right.path))) {
      if (!canonicalPath(edit.path)) throw new TransformScopeError(`transform path is not canonical repository-relative: ${edit.path}`);
      if (paths.has(edit.path)) throw new TransformPreconditionError(`duplicate exact text edit: ${edit.path}`);
      paths.add(edit.path);
      if (!allowedUnits.has(edit.unitId)) throw new TransformScopeError(`unit is outside the granted transform scope: ${edit.unitId}`);
      if (!pathMatchesBoundary(edit.path, approvedBoundary) || !authorizeRepositoryPath(authorization, edit.path).authorized) {
        throw new TransformScopeError(`exact text edit is outside the approved boundary: ${edit.path}`);
      }
      if (edit.before === edit.after) throw new TransformPreconditionError(`exact text edit is a no-op: ${edit.path}`);
      await this.mutation.assertWritable(edit.path);
      const actual = await this.mutation.readFile(edit.path) ?? null;
      const expected = expectedSide === "before" ? edit.before : edit.after;
      if (actual !== expected) {
        throw new TransformPreconditionError(`exact ${expectedSide} content mismatch: ${edit.path}`);
      }
      prepared.push({ ...edit, beforeHash: contentHash(edit.before), afterHash: contentHash(edit.after) });
    }
    return prepared;
  }
}
