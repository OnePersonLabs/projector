import {
  hashFramedDomain,
  type ContentHash,
  type EntityId,
  type OperationEvidence,
  type Transform,
  type TransformContext,
  type TransformPreview,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export type TransformProvenance = "source" | "generated";

export interface MoveOperationInput {
  unitId: EntityId;
  from: string;
  to: string;
  provenance: TransformProvenance;
}

export interface ReferenceUpdateInput {
  unitId: EntityId;
  path: string;
  from: string;
  to: string;
  expectedOccurrences: number;
  provenance: TransformProvenance;
}

export interface MoveReferenceUpdateInput {
  moves: readonly MoveOperationInput[];
  references: readonly ReferenceUpdateInput[];
}

/** The composition root adapts a durable journal transaction to this narrow facade. */
export interface TransformMutationPort {
  readFile(path: string): Promise<string | undefined>;
  assertWritable(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  checkpoint(id: string): Promise<void>;
}

export class TransformScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformScopeError";
  }
}

export class TransformPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformPreconditionError";
  }
}

interface PreparedMove {
  kind: "move";
  unitId: EntityId;
  from: string;
  to: string;
  provenance: TransformProvenance;
  content: string;
}

interface PreparedReference {
  kind: "update-reference";
  unitId: EntityId;
  path: string;
  from: string;
  to: string;
  provenance: TransformProvenance;
  before: string;
  after: string;
}

type PreparedOperation = PreparedMove | PreparedReference;

function provenanceRank(provenance: TransformProvenance): number {
  return provenance === "source" ? 0 : 1;
}

function operationPath(operation: PreparedOperation): string {
  return operation.kind === "move" ? operation.from : operation.path;
}

function orderOperations(operations: readonly PreparedOperation[]): PreparedOperation[] {
  return [...operations].sort((left, right) =>
    provenanceRank(left.provenance) - provenanceRank(right.provenance)
    || (left.kind === "move" ? 0 : 1) - (right.kind === "move" ? 0 : 1)
    || compareStrings(operationPath(left), operationPath(right)));
}

function assertRelativeRepositoryPath(path: string): void {
  if (
    path.length === 0
    || path.startsWith("/")
    || path.startsWith("\\")
    || /^[A-Za-z]:/u.test(path)
    || path.split(/[\\/]/u).some((segment) => segment === ".." || segment.length === 0)
  ) {
    throw new TransformScopeError(`transform path is outside the repository-relative scope: ${path}`);
  }
}

function countOccurrences(content: string, anchor: string): number {
  if (anchor.length === 0) throw new TransformPreconditionError("reference anchor cannot be empty");
  return content.split(anchor).length - 1;
}

function contentHash(content: string): ContentHash {
  return hashFramedDomain("transform-content", content);
}

export interface MoveReferenceTransformOptions {
  now?: () => string;
}

export class MoveReferenceTransform implements Transform<MoveReferenceUpdateInput> {
  readonly id = "move-reference-update";
  readonly version = "1";
  readonly description = "Move projection units and update exact registered references";

  private readonly now: () => string;
  private readonly appliedInputs = new WeakMap<TransformResult, MoveReferenceUpdateInput>();

  constructor(
    private readonly mutation: TransformMutationPort,
    options: MoveReferenceTransformOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async applies(input: MoveReferenceUpdateInput, context: TransformContext): Promise<boolean> {
    return (await this.prepare(input, context)).length > 0;
  }

  async preview(input: MoveReferenceUpdateInput, context: TransformContext): Promise<TransformPreview> {
    const operations = await this.prepare(input, context);
    return {
      applicable: operations.length > 0,
      operations: operations.map((operation) => operation.kind === "move"
        ? {
            kind: operation.kind,
            unitId: operation.unitId,
            from: operation.from,
            to: operation.to,
            provenance: operation.provenance,
          }
        : {
            kind: operation.kind,
            unitId: operation.unitId,
            path: operation.path,
            from: operation.from,
            to: operation.to,
            provenance: operation.provenance,
          }),
      touchedUnitIds: sortedUnique(operations.map((operation) => operation.unitId)),
      expectedDiff: operations.map((operation) => operation.kind === "move"
        ? `move ${operation.from} -> ${operation.to}`
        : `replace ${JSON.stringify(operation.from)} with ${JSON.stringify(operation.to)} in ${operation.path}`).join("\n"),
      warnings: [],
    };
  }

  async apply(input: MoveReferenceUpdateInput, context: TransformContext): Promise<TransformResult> {
    const operations = await this.prepare(input, context);
    if (context.dryRun || operations.length === 0) {
      return { transformId: this.id, changed: false, touchedUnitIds: [], operations: [] };
    }

    await this.mutation.checkpoint(`${this.id}@${this.version}:before`);
    const evidence: OperationEvidence[] = [];
    try {
      for (const [index, operation] of operations.entries()) {
        if (context.signal.aborted) throw new Error("transform aborted");
        if (operation.kind === "move") {
          await this.mutation.moveFile(operation.from, operation.to);
          evidence.push({
            operationId: `${this.id}:move:${index + 1}`,
            executor: "transform",
            unitIds: [operation.unitId],
            beforeHashes: [contentHash(operation.content)],
            afterHashes: [contentHash(operation.content)],
            evidenceIds: [],
            summary: `moved ${operation.from} to ${operation.to}`,
          });
        } else {
          await this.mutation.writeFile(operation.path, operation.after);
          evidence.push({
            operationId: `${this.id}:reference:${index + 1}`,
            executor: "transform",
            unitIds: [operation.unitId],
            beforeHashes: [contentHash(operation.before)],
            afterHashes: [contentHash(operation.after)],
            evidenceIds: [],
            summary: `updated registered reference in ${operation.path}`,
          });
        }
      }
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("transform mutation failed");
      const partial = error as Error & { partialResult?: TransformResult };
      partial.partialResult ??= {
        transformId: this.id,
        changed: evidence.length > 0,
        touchedUnitIds: sortedUnique(evidence.flatMap((operation) => operation.unitIds)),
        operations: evidence,
        checkpointId: `${this.id}@${this.version}:before`,
      };
      throw partial;
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:after`);
    const result: TransformResult = {
      transformId: this.id,
      changed: true,
      touchedUnitIds: sortedUnique(operations.map((operation) => operation.unitId)),
      operations: evidence,
      checkpointId: `${this.id}@${this.version}:after`,
    };
    this.appliedInputs.set(result, structuredClone(input));
    return result;
  }

  async verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]> {
    const startedAt = this.now();
    const violations: string[] = [];
    const appliedInput = this.appliedInputs.get(result);
    if (result.changed && appliedInput === undefined) {
      violations.push("transform result is not associated with this transform execution");
    } else if (appliedInput !== undefined) {
      try {
        const remaining = await this.prepare(appliedInput, context);
        if (remaining.length > 0) violations.push(`${remaining.length} postcondition operations remain`);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : "postcondition verification failed");
      }
    }
    if (context.signal.aborted) violations.push("verification aborted");
    const completedAt = this.now();
    return [{
      validatorId: `${this.id}.verify`,
      status: violations.length === 0 ? "passed" : "blocked",
      summary: violations.length === 0 ? "move/reference postconditions verified" : violations.join("; "),
      evidenceIds: [],
      evidenceLane: "runtime",
      independenceGroup: "deterministic-transform",
      assurance: "exact",
      authorSource: `${this.id}@${this.version}`,
      sideEffectClass: "none",
      details: { violations },
      startedAt,
      completedAt,
    }];
  }

  private async prepare(input: MoveReferenceUpdateInput, context: TransformContext): Promise<PreparedOperation[]> {
    const allowedUnits = new Set(context.allowedUnits);
    const operations: PreparedOperation[] = [];
    const destinations = new Set<string>();
    const movePaths = new Set<string>();

    for (const move of input.moves) {
      this.assertUnitAllowed(move.unitId, allowedUnits);
      assertRelativeRepositoryPath(move.from);
      assertRelativeRepositoryPath(move.to);
      if (move.from === move.to) throw new TransformPreconditionError(`move source equals destination: ${move.from}`);
      if (destinations.has(move.to)) throw new TransformPreconditionError(`duplicate move destination: ${move.to}`);
      destinations.add(move.to);
      movePaths.add(move.from);
      movePaths.add(move.to);
      await this.mutation.assertWritable(move.from);
      await this.mutation.assertWritable(move.to);
      const [source, destination] = await Promise.all([
        this.mutation.readFile(move.from),
        this.mutation.readFile(move.to),
      ]);
      if (source === undefined) {
        if (destination === undefined) {
          throw new TransformPreconditionError(`move source and destination are both missing: ${move.from}, ${move.to}`);
        }
        continue;
      }
      if (destination !== undefined) {
        throw new TransformPreconditionError(`move destination collision: ${move.to}`);
      }
      operations.push({ kind: "move", ...move, content: source });
    }

    const referenceContents = new Map<string, string>();
    const references = [...input.references].sort((left, right) =>
      provenanceRank(left.provenance) - provenanceRank(right.provenance)
      || compareStrings(left.path, right.path)
      || compareStrings(left.from, right.from)
      || compareStrings(left.to, right.to)
      || compareStrings(left.unitId, right.unitId));
    for (const reference of references) {
      this.assertUnitAllowed(reference.unitId, allowedUnits);
      assertRelativeRepositoryPath(reference.path);
      if (movePaths.has(reference.path)) {
        throw new TransformPreconditionError(`reference file also participates in a move: ${reference.path}`);
      }
      if (!Number.isSafeInteger(reference.expectedOccurrences) || reference.expectedOccurrences < 1) {
        throw new TransformPreconditionError(`invalid expected occurrence count for ${reference.path}`);
      }
      await this.mutation.assertWritable(reference.path);
      const content = referenceContents.get(reference.path) ?? await this.mutation.readFile(reference.path);
      if (content === undefined) throw new TransformPreconditionError(`reference file is missing: ${reference.path}`);
      const oldCount = countOccurrences(content, reference.from);
      if (oldCount === 0 && countOccurrences(content, reference.to) >= reference.expectedOccurrences) continue;
      if (oldCount !== reference.expectedOccurrences) {
        throw new TransformPreconditionError(
          `unresolved reference anchor in ${reference.path}: expected ${reference.expectedOccurrences}, found ${oldCount}`,
        );
      }
      const after = content.split(reference.from).join(reference.to);
      referenceContents.set(reference.path, after);
      operations.push({
        kind: "update-reference",
        ...reference,
        before: content,
        after,
      });
    }
    return orderOperations(operations);
  }

  private assertUnitAllowed(unitId: EntityId, allowedUnits: ReadonlySet<EntityId>): void {
    if (!allowedUnits.has(unitId)) throw new TransformScopeError(`unit is outside the granted transform scope: ${unitId}`);
  }
}

export type TransformCommutativity = "always" | "disjoint-units-only" | "never";

export interface RegisteredTransformMetadata {
  readonly preconditions: readonly string[];
  readonly writeScope: readonly string[];
  readonly predecessors: readonly string[];
  readonly exclusions: readonly string[];
  readonly commutativity: TransformCommutativity;
  readonly postconditions: readonly string[];
  readonly convergence:
    | { readonly kind: "idempotent" }
    | { readonly kind: "bounded-fixed-point"; readonly maximumIterations: number };
}

export interface RegisteredTransform<TInput = unknown> {
  readonly implementation: Transform<TInput>;
  readonly metadata: RegisteredTransformMetadata;
}

export interface TransformInvocation {
  readonly transformId: string;
  readonly version: string;
  readonly unitIds: readonly EntityId[];
  readonly exclusiveUnitClaim: boolean;
}

export class TransformClaimConflictError extends Error {
  constructor(unitId: EntityId, transformIds: readonly string[]) {
    super(`exclusive transform claim collision for ${unitId}: ${sortedUnique(transformIds).join(", ")}`);
    this.name = "TransformClaimConflictError";
  }
}

function normalizeMetadata(metadata: RegisteredTransformMetadata): RegisteredTransformMetadata {
  const convergence = metadata.convergence.kind === "idempotent"
    ? Object.freeze({ kind: "idempotent" as const })
    : Object.freeze({ kind: "bounded-fixed-point" as const, maximumIterations: metadata.convergence.maximumIterations });
  if (convergence.kind === "bounded-fixed-point" && (!Number.isSafeInteger(convergence.maximumIterations) || convergence.maximumIterations < 1)) {
    throw new TypeError("bounded transform convergence requires a positive maximum iteration count");
  }
  return Object.freeze({
    preconditions: Object.freeze(sortedUnique(metadata.preconditions)),
    writeScope: Object.freeze(sortedUnique(metadata.writeScope)),
    predecessors: Object.freeze(sortedUnique(metadata.predecessors)),
    exclusions: Object.freeze(sortedUnique(metadata.exclusions)),
    commutativity: metadata.commutativity,
    postconditions: Object.freeze(sortedUnique(metadata.postconditions)),
    convergence,
  });
}

export class TransformRegistry {
  private readonly transforms = new Map<string, RegisteredTransform<unknown>>();

  register<TInput>(registration: RegisteredTransform<TInput>): void {
    const key = this.key(registration.implementation.id, registration.implementation.version);
    if (this.transforms.has(key)) throw new TypeError(`transform already registered: ${key}`);
    this.transforms.set(key, Object.freeze({
      implementation: registration.implementation as Transform<unknown>,
      metadata: normalizeMetadata(registration.metadata),
    }));
  }

  get(id: string, version: string): RegisteredTransform<unknown> | undefined {
    return this.transforms.get(this.key(id, version));
  }

  orderInvocations(invocations: readonly TransformInvocation[]): TransformInvocation[] {
    const claims = new Map<EntityId, string[]>();
    const registeredInvocations = invocations.map((invocation) => {
      const registration = this.get(invocation.transformId, invocation.version);
      if (registration === undefined) {
        throw new TypeError(`unknown transform: ${invocation.transformId}@${invocation.version}`);
      }
      return { invocation, registration };
    });
    const invokedIds = new Set(invocations.map((invocation) => invocation.transformId));
    for (const { invocation, registration } of registeredInvocations) {
      for (const excludedId of registration.metadata.exclusions) {
        if (invokedIds.has(excludedId)) {
          throw new TypeError(`transform ${invocation.transformId} excludes ${excludedId}`);
        }
      }
      for (const predecessorId of registration.metadata.predecessors) {
        if (!invokedIds.has(predecessorId)) {
          throw new TypeError(`transform ${invocation.transformId} requires predecessor ${predecessorId}`);
        }
      }
    }
    for (const invocation of invocations) {
      if (!invocation.exclusiveUnitClaim) continue;
      for (const unitId of sortedUnique(invocation.unitIds)) {
        const owners = claims.get(unitId) ?? [];
        owners.push(`${invocation.transformId}@${invocation.version}`);
        claims.set(unitId, owners);
      }
    }
    for (const [unitId, owners] of claims) {
      if (owners.length > 1) throw new TransformClaimConflictError(unitId, owners);
    }
    const remaining = [...registeredInvocations];
    const completed = new Set<string>();
    const ordered: TransformInvocation[] = [];
    while (remaining.length > 0) {
      const ready = remaining.filter(({ registration }) =>
        registration.metadata.predecessors.every((predecessor) => completed.has(predecessor)));
      if (ready.length === 0) {
        throw new TypeError(`transform predecessor cycle: ${sortedUnique(remaining.map(({ invocation }) => invocation.transformId)).join(", ")}`);
      }
      ready.sort(({ invocation: left }, { invocation: right }) =>
        compareStrings(left.transformId, right.transformId) || compareStrings(left.version, right.version));
      for (const entry of ready) {
        ordered.push(entry.invocation);
        completed.add(entry.invocation.transformId);
        remaining.splice(remaining.indexOf(entry), 1);
      }
    }
    return ordered;
  }

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }
}
