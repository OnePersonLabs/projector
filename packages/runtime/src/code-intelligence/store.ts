import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  canonicalJson,
  CodeNeighborhoodSchema,
  CodePartitionSchema,
  CodeQuerySchema,
  CodeQueryResultSchema,
  CodeSnapshotSchema,
  hashFramedDomain,
  hashFramedCanonicalJsonChunks,
  type CodeNeighborhood,
  type CodeSymbol,
  type CodeEdge,
  type CodeLocation,
  type CodeProvenance,
  type CodePartition,
  type CodeQuery,
  type CodeQueryResult,
  type CodeSnapshot,
  type ObservationBudget,
} from "@projector/core";
import { initializeNormalized, migrateNormalized, migrateStageVersions } from "./store-schema.js";
import { CodeFactWriter } from "./store-fact-writer.js";
import { mergeCodePartition } from "./store-stage.js";
import { resolveDerivedCachePath } from "../cache/location.js";
import { beginSqliteWrite } from "../sqlite/write-admission.js";

function queryKey(query: ReturnType<typeof CodeQuerySchema.parse>): string {
  return canonicalJson({
    kind: query.kind,
    direction: query.direction,
    symbolId: query.symbolId,
    path: query.path,
  });
}
function decodeCursor(cursor: string, key: string, generation: string): { id: string; partitionId?: number } {
  const parsed = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  ) as { key?: unknown; generation?: unknown; after?: unknown; partitionId?: unknown };
  if (
    parsed.key !== key ||
    parsed.generation !== generation ||
    typeof parsed.after !== "string" ||
    (parsed.partitionId !== undefined && (!Number.isSafeInteger(parsed.partitionId) || Number(parsed.partitionId) < 1))
  )
    throw new Error(
      "Code query cursor does not belong to this query generation",
    );
  return { id: parsed.after, ...(parsed.partitionId === undefined ? {} : { partitionId: Number(parsed.partitionId) }) };
}

type FactRow = Record<string, string | number | null>;
const symbolFrom = `FROM code_symbols s JOIN code_paths dp ON dp.path_id=s.definition_path_id JOIN code_paths xp ON xp.path_id=s.extent_path_id JOIN code_provenances pr ON pr.provenance_id=s.provenance_id`;
const edgeFrom = `FROM code_edges e JOIN code_paths sp ON sp.path_id=e.source_path_id LEFT JOIN code_paths tp ON tp.path_id=e.target_path_id LEFT JOIN code_identities si ON si.identity_id=e.source_identity_id LEFT JOIN code_identities ti ON ti.identity_id=e.target_identity_id JOIN code_provenances pr ON pr.provenance_id=e.provenance_id`;
const symbolFields = `s.*,dp.path AS definition_path,xp.path AS extent_path,pr.provider,pr.version,pr.input_hash,pr.artifact`;
const edgeFields = `e.*,sp.path AS source_path,tp.path AS target_path,si.id AS source_symbol,ti.id AS target_symbol,pr.provider,pr.version,pr.input_hash,pr.artifact`;
function provenanceFrom(row: FactRow): CodeProvenance {
  return {
    provider: String(row.provider), version: String(row.version), inputHash: String(row.input_hash),
    ...(row.artifact === null ? {} : { artifact: String(row.artifact) }),
  };
}
function locationFrom(row: FactRow, prefix: "definition" | "extent" | "source"): CodeLocation {
  return {
    path: String(row[`${prefix}_path`]), start: Number(row[`${prefix}_start`]),
    end: Number(row[`${prefix}_end`]), line: Number(row[`${prefix}_line`]),
    column: Number(row[`${prefix}_column`]),
  };
}
function symbolFromRow(row: FactRow): CodeSymbol {
  return {
    id: String(row.id), name: String(row.name), kind: String(row.kind),
    definition: locationFrom(row, "definition"), extent: locationFrom(row, "extent"),
    ...(row.type_display === null ? {} : { typeDisplay: String(row.type_display) }),
    declarationHash: String(row.declaration_hash),
    ...(row.body_hash === null ? {} : { bodyHash: String(row.body_hash) }),
    provenance: provenanceFrom(row),
  };
}
function edgeFromRow(row: FactRow): CodeEdge {
  return {
    id: String(row.id), kind: row.kind as CodeEdge["kind"],
    source: locationFrom(row, "source"),
    ...(row.source_symbol === null ? {} : { sourceSymbolId: String(row.source_symbol) }),
    ...(row.target_symbol === null ? {} : { targetSymbolId: String(row.target_symbol) }),
    ...(row.target_path === null ? {} : { targetPath: String(row.target_path) }),
    resolution: row.resolution as CodeEdge["resolution"], provenance: provenanceFrom(row),
  };
}

/** Disposable immutable code facts. One transaction swaps the visible manifest with a CAS. */
export class SqliteCodeStore {
  private readonly db: DatabaseSync;
  private readonly legacyStageTables: boolean;
  private readSnapshotOpen = false;
  static async open(repositoryRoot: string): Promise<SqliteCodeStore> {
    const relative = ".projector/runtime/code/index.sqlite";
    for (const suffix of ["-wal", "-shm", "-journal"])
      await resolveDerivedCachePath(repositoryRoot, `${relative}${suffix}`);
    return new SqliteCodeStore(
      await resolveDerivedCachePath(repositoryRoot, relative),
    );
  }
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(toNamespacedPath(path), {
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    try {
      this.db.exec(
        "PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
      );
      const version = this.db.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      if (![0, 1, 2, 3, 4].includes(version.user_version))
        throw new Error("Unsupported derived code index version");
      if (version.user_version === 0) this.initializeSchema();
      if (version.user_version === 1 || version.user_version === 2)
        this.migrateToV3();
      if (version.user_version === 1 || version.user_version === 2 || version.user_version === 3)
        this.migrateToV4();
      this.legacyStageTables = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='code_stage_partitions'").get() !== undefined;
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private initializeSchema(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === 0) initializeNormalized(this.db);
      else if (version === 1 || version === 2) migrateNormalized(this.db);
      else if (version !== 4) throw new Error("Unsupported derived code index version during initialization");
      this.db.exec("COMMIT");
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  private migrateToV3(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === 1 || version === 2) migrateNormalized(this.db);
      else if (version !== 3 && version !== 4) throw new Error("Unsupported derived code index version during migration");
      this.db.exec("COMMIT");
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  private migrateToV4(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === 3) migrateStageVersions(this.db);
      else if (version !== 4) throw new Error("Unsupported derived code index version during stage migration");
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  close(): void {
    if (this.readSnapshotOpen) this.endReadSnapshot();
    this.db.close();
  }
  private rollbackAndRethrow(error: unknown): never {
    // SQLite may roll back the transaction itself (for example, on SQLITE_FULL).
    // A second ROLLBACK must not replace the failure that caused publication to stop.
    if (this.db.isTransaction) {
      try {
        this.db.exec("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Code store operation failed (${String(error)}), then rollback failed (${String(rollbackError)})`,
        );
      }
    }
    throw error;
  }
  /** Holds a consistent generation view until endReadSnapshot or close. */
  beginReadSnapshot(): void {
    if (this.readSnapshotOpen)
      throw new Error("Code read snapshot is already open");
    this.db.exec("BEGIN DEFERRED");
    try {
      // BEGIN DEFERRED alone does not acquire a SQLite read snapshot.
      this.db
        .prepare("SELECT generation FROM code_head WHERE singleton=1")
        .get();
      this.readSnapshotOpen = true;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  endReadSnapshot(): void {
    if (!this.readSnapshotOpen)
      throw new Error("Code read snapshot is not open");
    try {
      this.db.exec("ROLLBACK");
    } finally {
      this.readSnapshotOpen = false;
    }
  }
  withReadSnapshot<T>(read: () => T): T {
    this.beginReadSnapshot();
    try {
      const result = read();
      if (result !== null && typeof result === "object" && "then" in result) {
        throw new TypeError("Code read snapshot callback must be synchronous");
      }
      return result;
    } finally {
      this.endReadSnapshot();
    }
  }
  acquireLease(
    scope: string,
    token: string,
    ttlMs: number,
    now = Date.now(),
  ): boolean {
    this.validateLeaseRequest(scope, token, ttlMs);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const claimed = this.claimLeaseWithinTransaction(scope, token, ttlMs, now);
      this.db.exec("COMMIT");
      return claimed;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  /** Asynchronous lock admission for a worker that may wait behind a valid publication. */
  async acquireLeaseWhenReady(
    scope: string,
    token: string,
    ttlMs: number,
    options: { readonly signal?: AbortSignal | undefined; readonly budget?: ObservationBudget | undefined } = {},
  ): Promise<boolean> {
    this.validateLeaseRequest(scope, token, ttlMs);
    await beginSqliteWrite(this.db, { ...options, scope: `semantic-lease:${scope}` });
    try {
      const claimed = this.claimLeaseWithinTransaction(scope, token, ttlMs, Date.now());
      this.db.exec("COMMIT");
      return claimed;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  private validateLeaseRequest(scope: string, token: string, ttlMs: number): void {
    if (!scope || !token || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 300_000)
      throw new RangeError("Invalid code writer lease");
  }
  private claimLeaseWithinTransaction(scope: string, token: string, ttlMs: number, now: number): boolean {
    const lease = this.db.prepare("SELECT token,expires_ms FROM code_writer_leases WHERE scope=?")
      .get(scope) as { token: string; expires_ms: number } | undefined;
    if (lease !== undefined && lease.expires_ms > now && lease.token !== token) return false;
    this.db.prepare("INSERT INTO code_writer_leases(scope,token,expires_ms) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET token=excluded.token,expires_ms=excluded.expires_ms")
      .run(scope, token, now + ttlMs);
    return true;
  }
  heartbeatLease(
    scope: string,
    token: string,
    ttlMs: number,
    now = Date.now(),
  ): void {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 300_000)
      throw new RangeError("Invalid code writer lease heartbeat");
    const result = this.db
      .prepare(
        "UPDATE code_writer_leases SET expires_ms=? WHERE scope=? AND token=?",
      )
      .run(now + ttlMs, scope, token);
    if (result.changes !== 1) throw new Error("Code writer lease lost");
  }
  releaseLease(scope: string, token: string): void {
    this.db
      .prepare("DELETE FROM code_writer_leases WHERE scope=? AND token=?")
      .run(scope, token);
  }
  pin(
    generation: string,
    token: string,
    ttlMs: number,
    now = Date.now(),
  ): void {
    if (
      !token ||
      !Number.isSafeInteger(ttlMs) ||
      ttlMs < 1 ||
      ttlMs > 86_400_000
    )
      throw new RangeError("Invalid code generation pin");
    if (!this.hasGeneration(generation))
      throw new Error("Code generation is not available");
    this.db
      .prepare(
        "INSERT INTO code_generation_pins(generation,token,expires_ms) VALUES(?,?,?) ON CONFLICT(generation,token) DO UPDATE SET expires_ms=excluded.expires_ms",
      )
      .run(generation, token, now + ttlMs);
  }
  unpin(generation: string, token: string): void {
    this.db
      .prepare(
        "DELETE FROM code_generation_pins WHERE generation=? AND token=?",
      )
      .run(generation, token);
  }
  pinRetained(generation: string, owner: string): void {
    if (!owner) throw new RangeError("Retained code pin owner is required");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (!this.hasGeneration(generation))
        throw new Error("Code generation is not available");
      this.db
        .prepare(
          "INSERT OR IGNORE INTO code_retained_pins(generation,owner) VALUES(?,?)",
        )
        .run(generation, owner);
      this.db.exec("COMMIT");
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  releaseRetained(generation: string, owner: string): void {
    this.db
      .prepare("DELETE FROM code_retained_pins WHERE generation=? AND owner=?")
      .run(generation, owner);
  }
  releaseRetainedOwner(owner: string): void {
    this.db.prepare("DELETE FROM code_retained_pins WHERE owner=?").run(owner);
  }
  /** Keep exactly the durable baseline named by an owner, without a pin gap. */
  reconcileRetainedOwner(generation: string, owner: string): void {
    if (!owner) throw new RangeError("Retained code pin owner is required");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (!this.hasGeneration(generation))
        throw new Error("Code generation is not available");
      this.db
        .prepare("INSERT OR IGNORE INTO code_retained_pins(generation,owner) VALUES(?,?)")
        .run(generation, owner);
      this.db
        .prepare("DELETE FROM code_retained_pins WHERE owner=? AND generation<>?")
        .run(owner, generation);
      this.db.exec("COMMIT");
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  head(): string | null {
    return (
      (
        this.db
          .prepare("SELECT generation FROM code_head WHERE singleton=1")
          .get() as { generation: string } | undefined
      )?.generation ?? null
    );
  }
  hasGeneration(generation: string): boolean {
    return (
      this.db
        .prepare("SELECT 1 FROM code_manifests WHERE generation=?")
        .get(generation) !== undefined
    );
  }
  manifest(generation: string): Omit<CodeSnapshot, "partitions"> | undefined {
    const row = this.db
      .prepare("SELECT snapshot_json FROM code_manifests WHERE generation=?")
      .get(generation) as { snapshot_json: string } | undefined;
    return row === undefined
      ? undefined
      : (JSON.parse(row.snapshot_json) as Omit<CodeSnapshot, "partitions">);
  }
  private assertStageLease(stageId: string, lease: { readonly scope: string; readonly token: string }): void {
    const stage = this.db.prepare("SELECT source_identity,lease_scope,lease_token FROM code_stages WHERE stage_id=?").get(stageId) as
      | { source_identity: string; lease_scope: string; lease_token: string }
      | undefined;
    if (stage === undefined || stage.lease_scope !== lease.scope || stage.lease_token !== lease.token ||
      this.db.prepare("SELECT 1 FROM code_writer_leases WHERE scope=? AND token=?").get(lease.scope, lease.token) === undefined)
      throw new Error("Code staging lease lost or stage is unavailable");
  }
  /** Durable, invisible fact staging owned by one writer lease. A new run uses a new stage ID. */
  beginStage(stageId: string, sourceIdentity: string, lease: { readonly scope: string; readonly token: string }): void {
    if (!stageId || !sourceIdentity) throw new RangeError("Code stage identity is required");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.db.prepare("SELECT 1 FROM code_writer_leases WHERE scope=? AND token=?").get(lease.scope, lease.token) === undefined)
        throw new Error("Code staging lease lost");
      // A new lease proves earlier stages for this scope have no live owner.
      this.db.prepare("DELETE FROM code_stage_contributions WHERE stage_id IN (SELECT stage_id FROM code_stages WHERE lease_scope=? AND lease_token<>?)")
        .run(lease.scope, lease.token);
      this.db.prepare("DELETE FROM code_stage_versions WHERE stage_id IN (SELECT stage_id FROM code_stages WHERE lease_scope=? AND lease_token<>?)")
        .run(lease.scope, lease.token);
      if(this.legacyStageTables){
        this.db.prepare("DELETE FROM code_stage_symbols WHERE stage_id IN (SELECT stage_id FROM code_stages WHERE lease_scope=? AND lease_token<>?)").run(lease.scope, lease.token);
        this.db.prepare("DELETE FROM code_stage_partitions WHERE stage_id IN (SELECT stage_id FROM code_stages WHERE lease_scope=? AND lease_token<>?)").run(lease.scope, lease.token);
      }
      this.db.prepare("DELETE FROM code_stages WHERE lease_scope=? AND lease_token<>?")
        .run(lease.scope, lease.token);
      // Reclaim abandoned typed versions and old unpinned generations before
      // work begins, outside the final head-swap transaction.
      this.pruneUnpinnedWithinTransaction([this.head()]);
      this.db.prepare("INSERT INTO code_stages(stage_id,source_identity,lease_scope,lease_token) VALUES(?,?,?,?)")
        .run(stageId, sourceIdentity, lease.scope, lease.token);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  stagePartition(stageId: string, input: CodePartition, lease: { readonly scope: string; readonly token: string }): void {
    const partition = CodePartitionSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      const previous = this.stagedPartition(stageId, partition.path);
      const merged = CodePartitionSchema.parse(previous === undefined ? partition : mergeCodePartition(previous, partition));
      const digest = hashFramedDomain("projector-code-partition-v1", merged);
      const sortKey = Buffer.from(merged.path, "utf16le").swap16();
      const partitionId=new CodeFactWriter(this.db).insert(merged,digest);
      this.db.prepare("INSERT INTO code_stage_versions(stage_id,path,sort_key,digest,partition_id) VALUES(?,?,?,?,?) ON CONFLICT(stage_id,path) DO UPDATE SET digest=excluded.digest,partition_id=excluded.partition_id")
        .run(stageId, merged.path, sortKey, digest, partitionId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  /** Append a bounded batch from one provider, preserving its position in composite merge order. */
  stageContributionBatch(
    stageId: string, ordinal: number, inputs: readonly CodePartition[],
    lease: { readonly scope: string; readonly token: string },
  ): void {
    if (!Number.isSafeInteger(ordinal) || ordinal < 0) throw new RangeError("Code contribution ordinal is invalid");
    const partitions = inputs.map((input) => CodePartitionSchema.parse(input));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      const insert = this.db.prepare("INSERT INTO code_stage_contributions(stage_id,ordinal,path,sort_key,value) VALUES(?,?,?,?,?)");
      for (const partition of partitions)
        insert.run(stageId, ordinal, partition.path, Buffer.from(partition.path, "utf16le").swap16(), canonicalJson(partition));
      this.db.prepare("UPDATE code_stages SET dirty=1 WHERE stage_id=?").run(stageId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  stageContribution(stageId: string, ordinal: number, partition: CodePartition, lease: { readonly scope: string; readonly token: string }): void {
    this.stageContributionBatch(stageId, ordinal, [partition], lease);
  }
  contribution(stageId: string, ordinal: number, path: string): CodePartition | undefined {
    const row = this.db.prepare("SELECT value FROM code_stage_contributions WHERE stage_id=? AND ordinal=? AND path=?")
      .get(stageId, ordinal, path) as { value: string } | undefined;
    return row === undefined ? undefined : CodePartitionSchema.parse(JSON.parse(row.value));
  }
  contributionHasPath(stageId: string, path: string): boolean {
    return this.db.prepare("SELECT 1 FROM code_stage_contributions WHERE stage_id=? AND path=? LIMIT 1").get(stageId, path) !== undefined;
  }
  replaceContribution(
    stageId: string, ordinal: number, input: CodePartition,
    lease: { readonly scope: string; readonly token: string },
  ): void {
    const partition = CodePartitionSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      const changed = this.db.prepare("UPDATE code_stage_contributions SET value=? WHERE stage_id=? AND ordinal=? AND path=?")
        .run(canonicalJson(partition), stageId, ordinal, partition.path);
      if (changed.changes !== 1) throw new Error(`Staged code contribution is missing: ${partition.path}`);
      this.db.prepare("UPDATE code_stages SET dirty=1 WHERE stage_id=?").run(stageId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  /** Reduce ordered contributions one path at a time; stage remains invisible to readers. */
  materializeContributions(stageId: string, lease: { readonly scope: string; readonly token: string }): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      this.db.prepare("UPDATE code_stages SET dirty=1 WHERE stage_id=?").run(stageId);
      this.db.prepare("DELETE FROM code_stage_versions WHERE stage_id=?").run(stageId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
    const page = this.db.prepare("SELECT DISTINCT path,sort_key FROM code_stage_contributions WHERE stage_id=? AND sort_key>? ORDER BY sort_key LIMIT 64");
    const contributions = this.db.prepare("SELECT value FROM code_stage_contributions WHERE stage_id=? AND path=? ORDER BY ordinal");
    const insert = this.db.prepare("INSERT INTO code_stage_versions(stage_id,path,sort_key,digest,partition_id) VALUES(?,?,?,?,?)");
    let after = Buffer.alloc(0);
    while (true) {
      const paths = page.all(stageId, after) as { path: string; sort_key: Uint8Array }[];
      if (paths.length === 0) break;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.assertStageLease(stageId, lease);
        const writer=new CodeFactWriter(this.db);
        for (const path of paths) {
          let merged: CodePartition | undefined;
          for (const row of contributions.iterate(stageId, path.path)) {
            const next = CodePartitionSchema.parse(JSON.parse(String(row.value)));
            if (next.path !== path.path) throw new Error("Staged code contribution path changed");
            merged = merged === undefined ? next : mergeCodePartition(merged, next);
          }
          if (merged === undefined) throw new Error(`Staged code contribution missing: ${path.path}`);
          const validated=CodePartitionSchema.parse(merged);
          const digest=hashFramedDomain("projector-code-partition-v1", validated);
          insert.run(stageId, validated.path, path.sort_key,digest,writer.insert(validated,digest));
        }
        this.db.exec("COMMIT");
      } catch (error) { this.rollbackAndRethrow(error); }
      after = Buffer.from(paths.at(-1)!.sort_key);
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      this.db.prepare("UPDATE code_stages SET dirty=0 WHERE stage_id=?").run(stageId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  stageHasPath(stageId: string, path: string): boolean {
    return this.db.prepare("SELECT 1 FROM code_stage_versions WHERE stage_id=? AND path=?").get(stageId, path) !== undefined;
  }
  stagedPartition(stageId: string, path: string): CodePartition | undefined {
    const row = this.db.prepare("SELECT partition_id FROM code_stage_versions WHERE stage_id=? AND path=?").get(stageId, path) as { partition_id: number } | undefined;
    return row === undefined ? undefined : this.typedPartition(row.partition_id,path);
  }
  stagedSymbol(stageId: string, id: string): { path: string; definition: CodeLocation } | undefined {
    let row: { path: string; definition: CodeLocation } | undefined;
    for (const candidate of this.db.prepare(`SELECT v.path,dp.path AS definition_path,s.definition_start,s.definition_end,s.definition_line,s.definition_column
      FROM code_stage_versions v JOIN code_symbols s ON s.partition_id=v.partition_id
      JOIN code_paths dp ON dp.path_id=s.definition_path_id WHERE v.stage_id=? AND s.id=?`).iterate(stageId, id)) {
      const next = {path:String(candidate.path),definition:{path:String(candidate.definition_path),start:Number(candidate.definition_start),end:Number(candidate.definition_end),line:Number(candidate.definition_line),column:Number(candidate.definition_column)}};
      if (row === undefined || row.path.localeCompare(next.path) < 0) row = next;
    }
    return row;
  }
  replaceStagedPartition(stageId: string, input: CodePartition, lease: { readonly scope: string; readonly token: string }): void {
    const partition = CodePartitionSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      const digest=hashFramedDomain("projector-code-partition-v1",partition);
      const partitionId=new CodeFactWriter(this.db).insert(partition,digest);
      const changed = this.db.prepare("UPDATE code_stage_versions SET digest=?,partition_id=? WHERE stage_id=? AND path=?")
        .run(digest,partitionId,stageId,partition.path);
      if (changed.changes !== 1) throw new Error(`Staged code partition is missing: ${partition.path}`);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  *stagedPaths(stageId: string): Iterable<string> {
    for (const row of this.db.prepare("SELECT path FROM code_stage_versions WHERE stage_id=? ORDER BY sort_key").iterate(stageId))
      yield String(row.path);
  }
  stageRetain(stageId: string, generation: string, path: string, lease: { readonly scope: string; readonly token: string }): void {
    this.db.exec("BEGIN IMMEDIATE");
    try{
      this.assertStageLease(stageId,lease);
      const row=this.db.prepare("SELECT m.partition_id,p.digest FROM code_manifest_partitions m JOIN code_partitions p ON p.partition_id=m.partition_id WHERE m.generation=? AND m.path=?").get(generation,path) as {partition_id:number;digest:string}|undefined;
      if(row===undefined)throw new Error(`Code partition is not available: ${path}`);
      this.db.prepare("INSERT INTO code_stage_versions(stage_id,path,sort_key,digest,partition_id) VALUES(?,?,?,?,?) ON CONFLICT(stage_id,path) DO UPDATE SET digest=excluded.digest,partition_id=excluded.partition_id")
        .run(stageId,path,Buffer.from(path,"utf16le").swap16(),row.digest,row.partition_id);
      this.db.exec("COMMIT");
    }catch(error){this.rollbackAndRethrow(error);}
  }
  /** Publish the verified stage atomically; reclaim its spool after the head is durable. */
  publishStage(
    stageId: string, expectedGeneration: string | null,
    candidate: Omit<CodeSnapshot, "partitions">,
    lease: { readonly scope: string; readonly token: string },
  ): string {
    const { partitions: _ignored, ...metadata } = CodeSnapshotSchema.parse({ ...candidate, partitions: [] });
    const db = this.db;
    const generation = hashFramedCanonicalJsonChunks("projector-code-generation-v1", function* () {
      yield '{"entries":[';
      let first = true;
      for (const row of db.prepare("SELECT path,digest FROM code_stage_versions WHERE stage_id=? ORDER BY sort_key").iterate(stageId)) {
        if (!first) yield ",";
        first = false;
        yield canonicalJson({ path: String(row.path), digest: String(row.digest) });
      }
      yield '],"metadata":';
      yield canonicalJson(metadata);
      yield "}";
    });
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertStageLease(stageId, lease);
      if ((this.db.prepare("SELECT dirty FROM code_stages WHERE stage_id=?").get(stageId) as { dirty: number }).dirty !== 0)
        throw new Error("Code contributions must be materialized before publication");
      if (this.head() !== expectedGeneration)
        throw new Error("Code index head changed before publication");
      if (!this.hasGeneration(generation)) {
        this.db.prepare("INSERT INTO code_manifests(generation,snapshot_json) VALUES(?,?)")
          .run(generation, canonicalJson(metadata));
        this.db.prepare("INSERT INTO code_manifest_partitions(generation,path,partition_id) SELECT ?,path,partition_id FROM code_stage_versions WHERE stage_id=? ORDER BY sort_key")
          .run(generation,stageId);
      }
      this.db.prepare("INSERT INTO code_head(singleton,generation) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET generation=excluded.generation")
        .run(generation);
      this.assertStageLease(stageId, lease);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
    try {
      this.discardStage(stageId, lease);
    } catch (error) {
      // Publication already committed. The next lease reclaims this staged spool.
      console.warn(JSON.stringify({
        event: "code-stage-cleanup-failed",
        stageId,
        generation,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    return generation;
  }
  discardStage(stageId: string, lease: { readonly scope: string; readonly token: string }): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const stage = this.db.prepare("SELECT lease_scope,lease_token FROM code_stages WHERE stage_id=?").get(stageId) as
        | { lease_scope: string; lease_token: string }
        | undefined;
      if (stage !== undefined && (stage.lease_scope !== lease.scope || stage.lease_token !== lease.token))
        throw new Error("Code stage belongs to a different writer");
      this.db.prepare("DELETE FROM code_stage_contributions WHERE stage_id=?").run(stageId);
      this.db.prepare("DELETE FROM code_stage_versions WHERE stage_id=?").run(stageId);
      if(this.legacyStageTables){
        this.db.prepare("DELETE FROM code_stage_symbols WHERE stage_id=?").run(stageId);
        this.db.prepare("DELETE FROM code_stage_partitions WHERE stage_id=?").run(stageId);
      }
      this.db.prepare("DELETE FROM code_stages WHERE stage_id=?").run(stageId);
      this.db.exec("COMMIT");
    } catch (error) { this.rollbackAndRethrow(error); }
  }
  /** expectedGeneration is the prior visible head, including null for first publication. */
  publish(
    expectedGeneration: string | null,
    candidate: CodeSnapshot,
    lease?: { readonly scope: string; readonly token: string },
  ): string {
    const snapshot = CodeSnapshotSchema.parse(candidate);
    const unique = new Set<string>();
    const entries = snapshot.partitions
      .map((partition) => {
        if (unique.has(partition.path))
          throw new Error(`Duplicate code partition ${partition.path}`);
        unique.add(partition.path);
        if (partition.coverage.path !== partition.path)
          throw new Error("Code coverage path differs from partition path");
        return {
          partition,
          digest: hashFramedDomain("projector-code-partition-v1", partition),
        };
      })
      .sort((a, b) =>
        a.partition.path < b.partition.path
          ? -1
          : a.partition.path > b.partition.path
            ? 1
            : 0,
      );
    const { partitions: _partitions, ...metadata } = snapshot;
    const generation = hashFramedDomain("projector-code-generation-v1", {
      metadata,
      entries: entries.map(({ partition, digest }) => ({
        path: partition.path,
        digest,
      })),
    });
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.head() !== expectedGeneration)
        throw new Error("Code index head changed before publication");
      if (
        lease !== undefined &&
        this.db
          .prepare(
            "SELECT 1 FROM code_writer_leases WHERE scope=? AND token=?",
          )
          .get(lease.scope, lease.token) === undefined
      )
        throw new Error("Code writer lease lost before publication");
      // Reclaim before insertion so SQLite can reuse free pages for the candidate.
      // A failed publication rolls this cleanup back with the candidate and head swap.
      this.pruneUnpinnedWithinTransaction([generation, expectedGeneration]);
      if (!this.hasGeneration(generation)) {
        this.db
          .prepare(
            "INSERT INTO code_manifests(generation,snapshot_json) VALUES(?,?)",
          )
          .run(generation, canonicalJson(metadata));
        const writer = new CodeFactWriter(this.db);
        const insertMember = this.db.prepare(
          "INSERT INTO code_manifest_partitions(generation,path,partition_id) VALUES(?,?,?)",
        );
        for (const { partition, digest } of entries)
          insertMember.run(generation, partition.path, writer.insert(partition, digest));
      }
      this.db
        .prepare(
          "INSERT INTO code_head(singleton,generation) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET generation=excluded.generation",
        )
        .run(generation);
      if (
        lease !== undefined &&
        this.db
          .prepare(
            "SELECT 1 FROM code_writer_leases WHERE scope=? AND token=?",
          )
          .get(lease.scope, lease.token) === undefined
      )
        throw new Error("Code writer lease lost during publication");
      this.db.exec("COMMIT");
      return generation;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }
  private symbolRows(generation: string, condition: string, args: readonly (string | number)[], limit: number): FactRow[] {
    return this.db.prepare(
      `SELECT ${symbolFields} ${symbolFrom} WHERE ${condition} AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=s.partition_id) ORDER BY s.id,s.partition_id LIMIT ?`,
    ).all(...args, generation, limit) as FactRow[];
  }
  /** Begin at the endpoint index, then check that each candidate belongs to the requested generation. */
  private edgeSelection(
    generation: string, direction: "incoming" | "outgoing", target: { path: string } | { symbolId: string },
    kind: string | undefined, after: string, limit: number, afterPartitionId?: number,
  ): { sql: string; args: (string | number)[] } {
    const branches: string[] = [];
    const args: (string | number)[] = [];
    const afterClause = afterPartitionId === undefined ? "e.id>?" : "(e.id>? OR (e.id=? AND e.partition_id>?))";
    const afterArgs = afterPartitionId === undefined ? [after] : [after, after, afterPartitionId];
    const add = (column: string, value: string, table: "code_paths" | "code_identities", key: "path_id" | "identity_id", textColumn: "path" | "id") => {
      branches.push(`SELECT e.partition_id,e.id FROM code_edges e WHERE e.${column}=(SELECT ${key} FROM ${table} WHERE ${textColumn}=?) ${kind === undefined ? "" : "AND e.kind=?"} AND ${afterClause} AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=e.partition_id) ORDER BY e.id,e.partition_id LIMIT ?`);
      args.push(value);
      if (kind !== undefined) args.push(kind);
      args.push(...afterArgs, generation, limit);
    };
    if ("symbolId" in target) {
      add(direction === "incoming" ? "target_identity_id" : "source_identity_id", target.symbolId, "code_identities", "identity_id", "id");
    } else if (direction === "outgoing") {
      add("source_path_id", target.path, "code_paths", "path_id", "path");
    } else {
      add("target_path_id", target.path, "code_paths", "path_id", "path");
      branches.push(`SELECT e.partition_id,e.id FROM code_edges e WHERE e.target_identity_id IN (
        SELECT s.identity_id FROM code_symbols s WHERE s.definition_path_id=(SELECT path_id FROM code_paths WHERE path=?)
          AND EXISTS (SELECT 1 FROM code_manifest_partitions sm WHERE sm.generation=? AND sm.partition_id=s.partition_id)
      ) ${kind === undefined ? "" : "AND e.kind=?"} AND ${afterClause} AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=e.partition_id) ORDER BY e.id,e.partition_id LIMIT ?`);
      args.push(target.path, generation);
      if (kind !== undefined) args.push(kind);
      args.push(...afterArgs, generation, limit);
    }
    const candidates = branches.length === 1
      ? `SELECT * FROM candidate_0`
      : branches.map((_, index) => `SELECT * FROM candidate_${index}`).join(" UNION ");
    return {
      sql: `WITH ${branches.map((branch, index) => `candidate_${index} AS (${branch})`).join(", ")}, candidates AS (${candidates}) SELECT ${edgeFields} ${edgeFrom} JOIN candidates c ON c.partition_id=e.partition_id AND c.id=e.id ORDER BY e.id,e.partition_id LIMIT ?`,
      args: [...args, limit],
    };
  }
  private edgeRows(
    generation: string, direction: "incoming" | "outgoing", target: { path: string } | { symbolId: string },
    kind: string | undefined, after: string, limit: number, afterPartitionId?: number,
  ): FactRow[] {
    const { sql, args } = this.edgeSelection(generation, direction, target, kind, after, limit, afterPartitionId);
    return this.db.prepare(sql).all(...args) as FactRow[];
  }
  query(input: CodeQuery): CodeQueryResult {
    const query = CodeQuerySchema.parse(input);
    const key = queryKey(query);
    const after: { id: string; partitionId?: number } = query.cursor === undefined
      ? { id: "" }
      : decodeCursor(query.cursor, key, query.generation);
    if (!this.hasGeneration(query.generation))
      throw new Error("Code generation is not available");
    const coverage: CodeQueryResult["coverage"] = [];
    if (query.path !== undefined) {
      const row = this.db.prepare(
        "SELECT p.coverage_json FROM code_manifest_partitions m JOIN code_partitions p ON p.partition_id=m.partition_id WHERE m.generation=? AND m.path=?",
      ).get(query.generation, query.path) as { coverage_json: string } | undefined;
      if (row !== undefined) coverage.push(JSON.parse(row.coverage_json));
    }
    const symbolQuery = query.kind === "symbol" || query.kind === "definition";
    const symbolAfter = after.partitionId === undefined
      ? "s.id>?"
      : "(s.id>? OR (s.id=? AND s.partition_id>?))";
    const symbolAfterArgs = after.partitionId === undefined
      ? [after.id]
      : [after.id, after.id, after.partitionId];
    const rows = symbolQuery
      ? this.symbolRows(query.generation,
          query.symbolId !== undefined ? `s.identity_id=(SELECT identity_id FROM code_identities WHERE id=?) AND ${symbolAfter}` : `s.definition_path_id=(SELECT path_id FROM code_paths WHERE path=?) AND ${symbolAfter}`,
          [query.symbolId ?? query.path!, ...symbolAfterArgs], query.limit + 1)
      : this.edgeRows(query.generation, query.direction,
          query.symbolId !== undefined ? { symbolId: query.symbolId } : { path: query.path! },
          query.kind, after.id, query.limit + 1, after.partitionId);
    const page = rows.slice(0, query.limit);
    const result = {
      schemaVersion: "projector.code-query-result/v1" as const,
      generation: query.generation,
      symbols: symbolQuery ? page.map(symbolFromRow) : [],
      edges: symbolQuery ? [] : page.map(edgeFromRow),
      coverage,
      ...(rows.length > query.limit ? {
        nextCursor: Buffer.from(canonicalJson({
          generation: query.generation, key, after: String(page[page.length - 1]!.id),
          partitionId: Number(page[page.length - 1]!.partition_id),
        })).toString("base64url"),
      } : {}),
    };
    return CodeQueryResultSchema.parse(result);
  }
  partition(generation: string, path: string): CodePartition | undefined {
    const row = this.db.prepare(
      "SELECT partition_id FROM code_manifest_partitions WHERE generation=? AND path=?",
    ).get(generation, path) as { partition_id: number } | undefined;
    if (row === undefined) return undefined;
    return this.typedPartition(row.partition_id,path);
  }
  private typedPartition(partitionId: number, path: string): CodePartition {
    const row = this.db.prepare("SELECT input_hash,coverage_json FROM code_partitions WHERE partition_id=?").get(partitionId) as
      | {input_hash:string;coverage_json:string}|undefined;
    if(row===undefined)throw new Error("Staged code partition version is unavailable");
    const symbols = (this.db.prepare(
      `SELECT ${symbolFields} ${symbolFrom} WHERE s.partition_id=? ORDER BY s.id`,
    ).all(partitionId) as FactRow[]).map(symbolFromRow);
    const edges = (this.db.prepare(
      `SELECT ${edgeFields} ${edgeFrom} WHERE e.partition_id=? ORDER BY e.id`,
    ).all(partitionId) as FactRow[]).map(edgeFromRow);
    return CodePartitionSchema.parse({
      path, inputHash: row.input_hash, coverage: JSON.parse(row.coverage_json), symbols, edges,
    });
  }
  paths(
    generation: string,
    limit = 1000,
    after = "",
  ): { paths: string[]; nextCursor?: string } {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new RangeError("Code path limit must be 1..1000");
    if (!this.hasGeneration(generation))
      throw new Error("Code generation is not available");
    const rows = this.db
      .prepare(
        "SELECT path FROM code_manifest_partitions WHERE generation=? AND path>? ORDER BY path LIMIT ?",
      )
      .all(generation, after, limit + 1) as { path: string }[];
    const paths = rows.slice(0, limit).map((row) => row.path);
    return rows.length > limit
      ? { paths, nextCursor: paths[paths.length - 1]! }
      : { paths };
  }
  symbolAt(
    generation: string, path: string, offset: number,
  ): CodeQueryResult["symbols"][number] | undefined {
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new RangeError("Code offset must be nonnegative");
    const row = this.db.prepare(
      `SELECT ${symbolFields} ${symbolFrom}
       WHERE s.definition_path_id=(SELECT path_id FROM code_paths WHERE path=?) AND s.definition_start<=? AND s.definition_end>?
       AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=s.partition_id)
       ORDER BY (s.definition_end-s.definition_start),s.id LIMIT 1`,
    ).get(path, offset, offset, generation) as FactRow | undefined;
    if (row !== undefined) return symbolFromRow(row);
    const target = this.db.prepare(
      `SELECT ${symbolFields} ${symbolFrom}
       JOIN code_edges e ON e.target_identity_id=s.identity_id
       WHERE e.source_path_id=(SELECT path_id FROM code_paths WHERE path=?)
       AND e.resolution='resolved' AND e.source_start<=? AND e.source_end>?
       AND EXISTS (SELECT 1 FROM code_manifest_partitions em WHERE em.generation=? AND em.partition_id=e.partition_id)
       AND EXISTS (SELECT 1 FROM code_manifest_partitions sm WHERE sm.generation=? AND sm.partition_id=s.partition_id)
       ORDER BY (e.source_end-e.source_start),e.id,s.id LIMIT 1`,
    ).get(path, offset, offset, generation, generation) as FactRow | undefined;
    return target === undefined ? undefined : symbolFromRow(target);
  }
  symbolsByName(
    generation: string, name: string, limit = 100,
  ): CodeQueryResult["symbols"] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new RangeError("Code symbol limit must be 1..1000");
    return this.symbolRows(generation, "s.name=?", [name], limit).map(symbolFromRow);
  }
  neighborhood(
    generation: string, path: string, maxEdges = 500,
  ): CodeNeighborhood {
    if (!Number.isSafeInteger(maxEdges) || maxEdges < 1 || maxEdges > 5000)
      throw new RangeError("Code neighborhood edge limit must be 1..5000");
    if (!this.hasGeneration(generation))
      throw new Error("Code generation is not available");
    const partition = this.db.prepare(
      "SELECT p.coverage_json,m.partition_id FROM code_manifest_partitions m JOIN code_partitions p ON p.partition_id=m.partition_id WHERE m.generation=? AND m.path=?",
    ).get(generation, path) as { coverage_json: string; partition_id: number } | undefined;
    const symbols = partition === undefined ? [] : this.symbolRows(
      generation, "s.partition_id=?", [partition.partition_id], Number.MAX_SAFE_INTEGER,
    ).map(symbolFromRow);
    const outgoingRows = this.edgeRows(generation, "outgoing", { path }, undefined, "", maxEdges + 1);
    const incomingRows = this.edgeRows(generation, "incoming", { path }, undefined, "", maxEdges + 1);
    const targetPath = this.db.prepare(
      `SELECT p.path FROM code_symbols s JOIN code_paths p ON p.path_id=s.definition_path_id
       WHERE s.identity_id=(SELECT identity_id FROM code_identities WHERE id=?)
       AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=s.partition_id)
       ORDER BY p.path LIMIT 1`,
    );
    const targetPaths = new Map<string, string | null>();
    const enrich = (row: FactRow): CodeEdge => {
      const edge = edgeFromRow(row);
      if (edge.targetPath !== undefined || edge.targetSymbolId === undefined) return edge;
      let target = targetPaths.get(edge.targetSymbolId);
      if (target === undefined) {
        target = (targetPath.get(edge.targetSymbolId, generation) as { path: string } | undefined)?.path ?? null;
        targetPaths.set(edge.targetSymbolId, target);
      }
      return target === null ? edge : { ...edge, targetPath: target };
    };
    const outgoing = outgoingRows.slice(0, maxEdges).map(enrich);
    const incoming = incomingRows.slice(0, maxEdges).map(enrich);
    const relatedPaths = [...new Set([
      ...outgoing.map((edge) => edge.targetPath),
      ...incoming.map((edge) => edge.source.path),
    ].filter((value): value is string => value !== undefined && value !== path))].sort();
    return CodeNeighborhoodSchema.parse({
      generation, path, symbols, incoming, outgoing,
      ...(partition === undefined ? {} : { coverage: JSON.parse(partition.coverage_json) }),
      relatedPaths, truncated: outgoingRows.length > maxEdges || incomingRows.length > maxEdges,
    });
  }
  /** Complete addressed population digest, independent of bounded result pages. */
  dependencyVersion(generation: string, path: string): string {
    if (!this.hasGeneration(generation))
      throw new Error("Code generation is not available");
    const digest = createHash("sha256");
    const add = (kind: string, value: string): void => {
      const encoded = Buffer.from(`${kind}:${value}`, "utf8");
      const size = Buffer.allocUnsafe(4);
      size.writeUInt32BE(encoded.length);
      digest.update(size);
      digest.update(encoded);
    };
    add("path", path);
    const partition = this.db.prepare(
      "SELECT p.digest FROM code_manifest_partitions m JOIN code_partitions p ON p.partition_id=m.partition_id WHERE m.generation=? AND m.path=?",
    ).get(generation, path) as { digest: string } | undefined;
    add("partition", partition?.digest ?? "absent");
    for (const row of this.db.prepare(
      `SELECT s.id FROM code_symbols s WHERE s.definition_path_id=(SELECT path_id FROM code_paths WHERE path=?)
       AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=s.partition_id)
       ORDER BY s.id`,
    ).iterate(path, generation))
      add("symbol", String(row.id));
    for (const row of this.db.prepare(
      `SELECT e.id FROM code_edges e WHERE e.source_path_id=(SELECT path_id FROM code_paths WHERE path=?)
       AND EXISTS (SELECT 1 FROM code_manifest_partitions m WHERE m.generation=? AND m.partition_id=e.partition_id)
       ORDER BY e.id`,
    ).iterate(path, generation))
      add("outgoing", String(row.id));
    const incoming = this.edgeSelection(generation, "incoming", { path }, undefined, "", Number.MAX_SAFE_INTEGER);
    for (const row of this.db.prepare(incoming.sql).iterate(...incoming.args))
      add("incoming", canonicalJson(edgeFromRow(row as FactRow)));
    return `sha256:v1:${digest.digest("hex")}`;
  }
  /** Explicit cleanup preserves the head, newest old generation, and all unreleased pins. */
  pruneUnpinned(_now = Date.now()): number {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const removed = this.pruneUnpinnedWithinTransaction([this.head()]);
      this.db.exec("COMMIT");
      return removed;
    } catch (error) {
      this.rollbackAndRethrow(error);
    }
  }

  private pruneUnpinnedWithinTransaction(
    keep: readonly (string | null)[],
  ): number {
    const retained = new Set(
      keep.filter((generation): generation is string => generation !== null),
    );
    const newestOld = this.db
      .prepare(
        "SELECT generation FROM code_manifests WHERE generation<>? ORDER BY rowid DESC LIMIT 1",
      )
      .get(keep[0] ?? "") as { generation: string } | undefined;
    if (newestOld !== undefined) retained.add(newestOld.generation);
    for (const row of this.db
      .prepare("SELECT generation FROM code_generation_pins")
      .all() as { generation: string }[]) {
      retained.add(row.generation);
    }
    for (const row of this.db
      .prepare("SELECT generation FROM code_retained_pins")
      .all() as { generation: string }[]) {
      retained.add(row.generation);
    }
    let removed = 0;
    for (const row of this.db
      .prepare("SELECT generation FROM code_manifests")
      .all() as { generation: string }[]) {
      if (retained.has(row.generation)) continue;
      this.db
        .prepare("DELETE FROM code_manifest_partitions WHERE generation=?")
        .run(row.generation);
      this.db
        .prepare("DELETE FROM code_manifests WHERE generation=?")
        .run(row.generation);
      removed++;
    }
    const livePartitions="SELECT partition_id FROM code_manifest_partitions UNION SELECT partition_id FROM code_stage_versions";
    this.db.exec(`DELETE FROM code_edges WHERE partition_id NOT IN (${livePartitions})`);
    this.db.exec(`DELETE FROM code_symbols WHERE partition_id NOT IN (${livePartitions})`);
    this.db.exec(`DELETE FROM code_partitions WHERE partition_id NOT IN (${livePartitions})`);
    this.db.exec("DELETE FROM code_provenances WHERE provenance_id NOT IN (SELECT provenance_id FROM code_symbols UNION SELECT provenance_id FROM code_edges)");
    this.db.exec("DELETE FROM code_identities WHERE identity_id NOT IN (SELECT identity_id FROM code_symbols UNION SELECT source_identity_id FROM code_edges WHERE source_identity_id IS NOT NULL UNION SELECT target_identity_id FROM code_edges WHERE target_identity_id IS NOT NULL)");
    this.db.exec("DELETE FROM code_paths WHERE path_id NOT IN (SELECT path_id FROM code_partitions UNION SELECT definition_path_id FROM code_symbols UNION SELECT extent_path_id FROM code_symbols UNION SELECT source_path_id FROM code_edges UNION SELECT target_path_id FROM code_edges WHERE target_path_id IS NOT NULL)");
    return removed;
  }
}
