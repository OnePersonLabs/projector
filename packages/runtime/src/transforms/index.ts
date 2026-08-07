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
  expectedContentHash: ContentHash;
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

function pathMatchesBoundary(path: string, boundary: readonly string[]): boolean {
  return boundary.some((pattern) => {
    if (pattern === "**") return true;
    if (pattern.endsWith("/**")) {
      const root = pattern.slice(0, -3).replace(/\/$/u, "");
      return path === root || path.startsWith(`${root}/`);
    }
    return path === pattern;
  });
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
      const result: TransformResult = { transformId: this.id, changed: false, touchedUnitIds: [], operations: [] };
      if (!context.dryRun) this.appliedInputs.set(result, structuredClone(input));
      return result;
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
    const approvedBoundary = (context as TransformContext & { approvedBoundary?: readonly string[] }).approvedBoundary;
    if (approvedBoundary === undefined || approvedBoundary.length === 0) {
      throw new TransformScopeError("transform context has no approved path boundary");
    }
    const allowedPathBoundary = (context as TransformContext & { allowedPathBoundary?: readonly string[] }).allowedPathBoundary ?? [];
    const forbiddenBoundary = (context as TransformContext & { forbiddenBoundary?: readonly string[] }).forbiddenBoundary ?? [];
    const pathIsApproved = (path: string): boolean =>
      pathMatchesBoundary(path, approvedBoundary)
      && (allowedPathBoundary.length === 0 || pathMatchesBoundary(path, allowedPathBoundary))
      && !pathMatchesBoundary(path, forbiddenBoundary);
    const operations: PreparedOperation[] = [];
    const destinations = new Set<string>();
    const movePaths = new Set<string>();
    const moveSources = new Set<string>();

    for (const move of input.moves) {
      if (moveSources.has(move.from)) throw new TransformPreconditionError(`duplicate move source claim: ${move.from}`);
      if (destinations.has(move.to)) throw new TransformPreconditionError(`duplicate move destination: ${move.to}`);
      moveSources.add(move.from);
      destinations.add(move.to);
    }
    const referenceClaims = new Set<string>();
    const referencesByPath = new Map<string, ReferenceUpdateInput[]>();
    for (const reference of input.references) {
      const claim = `${reference.path}\0${reference.from}`;
      if (referenceClaims.has(claim)) {
        throw new TransformPreconditionError(`duplicate reference claim: ${reference.path} ${reference.from}`);
      }
      referenceClaims.add(claim);
      if (reference.from === reference.to || reference.from.includes(reference.to) || reference.to.includes(reference.from)) {
        throw new TransformPreconditionError(`non-convergent replacement in ${reference.path}: ${reference.from} -> ${reference.to}`);
      }
      const prior = referencesByPath.get(reference.path) ?? [];
      const overlap = prior.find((candidate) =>
        reference.to.includes(candidate.from) || candidate.to.includes(reference.from));
      if (overlap !== undefined) {
        throw new TransformPreconditionError(`overlapping replacement claims in ${reference.path}`);
      }
      prior.push(reference);
      referencesByPath.set(reference.path, prior);
    }

    for (const move of input.moves) {
      this.assertUnitAllowed(move.unitId, allowedUnits);
      assertRelativeRepositoryPath(move.from);
      assertRelativeRepositoryPath(move.to);
      if (!pathIsApproved(move.from) || !pathIsApproved(move.to)) {
        throw new TransformScopeError(`move path is outside the approved boundary: ${move.from} -> ${move.to}`);
      }
      if (move.from === move.to) throw new TransformPreconditionError(`move source equals destination: ${move.from}`);
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
        if (move.expectedContentHash === undefined) {
          throw new TransformPreconditionError(`missing move source requires an expected content identity: ${move.from}`);
        }
        if (contentHash(destination) !== move.expectedContentHash) {
          throw new TransformPreconditionError(`move destination content identity does not match approval: ${move.to}`);
        }
        continue;
      }
      if (contentHash(source) !== move.expectedContentHash) {
        throw new TransformPreconditionError(`move source content identity does not match approval: ${move.from}`);
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
      if (!pathIsApproved(reference.path)) {
        throw new TransformScopeError(`reference path is outside the approved boundary: ${reference.path}`);
      }
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
  readonly unitClaim: "exclusive" | "shared";
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
    unitClaim: metadata.unitClaim,
    convergence,
  });
}

interface RegistryEntry {
  readonly registeredId: string;
  readonly registeredVersion: string;
  readonly registration: RegisteredTransform<unknown>;
}

interface InvocationGroup {
  readonly kind: "sequential" | "bounded-fixed-point";
  readonly invocations: TransformInvocation[];
  readonly maximumIterations: number;
}

export class TransformRegistry {
  private readonly transforms = new Map<string, RegistryEntry>();

  register<TInput>(registration: RegisteredTransform<TInput>): void {
    const registeredId = registration.implementation.id;
    const registeredVersion = registration.implementation.version;
    if (registeredId.length === 0 || registeredVersion.length === 0) {
      throw new TypeError("transform identity and version cannot be blank");
    }
    const key = this.key(registeredId, registeredVersion);
    if (this.transforms.has(key)) throw new TypeError(`transform already registered: ${key}`);
    const normalized = Object.freeze({
      implementation: registration.implementation as Transform<unknown>,
      metadata: normalizeMetadata(registration.metadata),
    });
    Object.freeze(registration.implementation);
    this.transforms.set(key, Object.freeze({ registeredId, registeredVersion, registration: normalized }));
  }

  get(id: string, version: string): RegisteredTransform<unknown> | undefined {
    const entry = this.transforms.get(this.key(id, version));
    if (entry === undefined) return undefined;
    this.assertIdentity(entry);
    return entry.registration;
  }

  orderInvocations(invocations: readonly TransformInvocation[]): TransformInvocation[] {
    return this.compositionGroups(invocations).flatMap((group) => group.invocations);
  }

  async convergeInvocations(
    invocations: readonly TransformInvocation[],
    execute: (
      invocation: TransformInvocation,
      iteration: number,
    ) => Promise<{ readonly changed: boolean }>,
  ): Promise<{ converged: true; iterations: number }> {
    const groups = this.compositionGroups(invocations);
    let iterations = groups.length === 0 ? 0 : 1;
    for (const group of groups) {
      if (group.kind === "sequential") {
        for (const invocation of group.invocations) await execute(invocation, 1);
        continue;
      }
      let converged = false;
      for (let iteration = 1; iteration <= group.maximumIterations; iteration += 1) {
        let changed = false;
        for (const invocation of group.invocations) {
          const result = await execute(invocation, iteration);
          changed ||= result.changed;
        }
        iterations = Math.max(iterations, iteration);
        if (!changed) {
          converged = true;
          break;
        }
      }
      if (!converged) {
        throw new Error(
          `transform fixed-point group ${group.invocations.map((invocation) => invocation.transformId).join(", ")} `
          + `did not converge within ${group.maximumIterations} iterations`,
        );
      }
    }
    return { converged: true, iterations };
  }

  private compositionGroups(invocations: readonly TransformInvocation[]): InvocationGroup[] {
    const claims = new Map<EntityId, string[]>();
    const registeredInvocations = invocations.map((invocation) => {
      const registration = this.get(invocation.transformId, invocation.version);
      if (registration === undefined) {
        throw new TypeError(`unknown transform: ${invocation.transformId}@${invocation.version}`);
      }
      return { invocation, registration };
    });
    const invokedIds = new Set(invocations.map((invocation) => invocation.transformId));
    const registrationById = new Map<string, RegisteredTransform<unknown>>();
    for (const { invocation, registration } of registeredInvocations) {
      const existing = registrationById.get(invocation.transformId);
      if (existing !== undefined && existing.implementation.version !== invocation.version) {
        throw new TypeError(`multiple versions of transform ${invocation.transformId} cannot share one composition`);
      }
      registrationById.set(invocation.transformId, registration);
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
      if (registration.metadata.unitClaim !== "exclusive") continue;
      for (const unitId of sortedUnique(invocation.unitIds)) {
        const owners = claims.get(unitId) ?? [];
        owners.push(`${invocation.transformId}@${invocation.version}`);
        claims.set(unitId, owners);
      }
    }
    for (const [unitId, owners] of claims) {
      if (owners.length > 1) throw new TransformClaimConflictError(unitId, owners);
    }

    let nextIndex = 0;
    const indices = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const components: string[][] = [];
    const visit = (id: string): void => {
      const ownIndex = nextIndex;
      nextIndex += 1;
      indices.set(id, ownIndex);
      lowLinks.set(id, ownIndex);
      stack.push(id);
      onStack.add(id);
      const registration = registrationById.get(id);
      if (registration === undefined) throw new TypeError(`unknown transform in composition: ${id}`);
      for (const predecessor of registration.metadata.predecessors) {
        if (!indices.has(predecessor)) {
          visit(predecessor);
          lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, lowLinks.get(predecessor) ?? ownIndex));
        } else if (onStack.has(predecessor)) {
          lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, indices.get(predecessor) ?? ownIndex));
        }
      }
      if (lowLinks.get(id) === ownIndex) {
        const component: string[] = [];
        let member: string | undefined;
        do {
          member = stack.pop();
          if (member === undefined) throw new Error("invalid transform component stack");
          onStack.delete(member);
          component.push(member);
        } while (member !== id);
        components.push(component.sort(compareStrings));
      }
    };
    for (const id of [...invokedIds].sort(compareStrings)) if (!indices.has(id)) visit(id);

    const componentById = new Map<string, number>();
    components.forEach((component, index) => component.forEach((id) => componentById.set(id, index)));
    const outgoing = components.map(() => new Set<number>());
    const indegree = components.map(() => 0);
    for (const [id, registration] of registrationById) {
      const currentComponent = componentById.get(id);
      if (currentComponent === undefined) throw new Error(`missing component for ${id}`);
      for (const predecessor of registration.metadata.predecessors) {
        const predecessorComponent = componentById.get(predecessor);
        if (predecessorComponent === undefined || predecessorComponent === currentComponent) continue;
        const edges: Set<number> | undefined = outgoing[predecessorComponent];
        if (edges !== undefined && !edges.has(currentComponent)) {
          edges.add(currentComponent);
          indegree[currentComponent] = (indegree[currentComponent] ?? 0) + 1;
        }
      }
    }

    const groups: InvocationGroup[] = [];
    const remainingComponents = new Set(components.map((_component, index) => index));
    while (remainingComponents.size > 0) {
      const ready = [...remainingComponents]
        .filter((index) => indegree[index] === 0)
        .sort((left, right) => compareStrings(components[left]?.[0] ?? "", components[right]?.[0] ?? ""));
      if (ready.length === 0) throw new Error("transform component graph is cyclic");
      for (const componentIndex of ready) {
        const component = components[componentIndex] ?? [];
        const selfCycle = component.some((id) => registrationById.get(id)?.metadata.predecessors.includes(id));
        const isCycle = component.length > 1 || selfCycle;
        const convergences = component.map((id) => registrationById.get(id)?.metadata.convergence);
        if (isCycle && convergences.some((convergence) => convergence?.kind !== "bounded-fixed-point")) {
          throw new TypeError(`transform predecessor cycle is not declared bounded-convergent: ${component.join(", ")}`);
        }
        const maximumIterations = isCycle
          ? Math.min(...convergences.map((convergence) =>
              convergence?.kind === "bounded-fixed-point" ? convergence.maximumIterations : 0))
          : 1;
        const componentInvocations = registeredInvocations
          .filter(({ invocation }) => component.includes(invocation.transformId))
          .map(({ invocation }) => structuredClone(invocation))
          .sort((left, right) =>
            compareStrings(left.transformId, right.transformId) || compareStrings(left.version, right.version));
        groups.push({
          kind: isCycle ? "bounded-fixed-point" : "sequential",
          invocations: componentInvocations,
          maximumIterations,
        });
        remainingComponents.delete(componentIndex);
        for (const dependent of outgoing[componentIndex] ?? []) {
          indegree[dependent] = (indegree[dependent] ?? 0) - 1;
        }
      }
    }
    return groups;
  }

  private assertIdentity(entry: RegistryEntry): void {
    if (
      entry.registration.implementation.id !== entry.registeredId
      || entry.registration.implementation.version !== entry.registeredVersion
    ) {
      throw new Error(
        `transform implementation identity drift: expected ${entry.registeredId}@${entry.registeredVersion}, `
        + `received ${entry.registration.implementation.id}@${entry.registration.implementation.version}`,
      );
    }
  }

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }
}
