import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { canonicalJson, hashFramedDomain, type CodeSnapshot } from "@projector/core";
import { SqliteCodeStore } from "./store.js";
import { CodeFactWriter } from "./store-fact-writer.js";

const location = { path: "src/a.ts", start: 0, end: 1, line: 1, column: 1 };
const provenance = { provider: "fixture", version: "1", inputHash: "input1" };
const snapshot = (inputHash: string): CodeSnapshot => ({
  schemaVersion: "projector.code-intelligence/v1",
  provider: "fixture",
  providerVersion: "1",
  inputFingerprint: inputHash,
  configFingerprint: "config1",
  resolutionFingerprint: "resolution1",
  binding: {
    status: "verified",
    checkoutId: "checkout",
    worktreeDigest: "tree",
    projectKey: "project",
    sourceInputs: [{ path: "src/a.ts", contentHash: inputHash }],
    configInputs: [],
    resolutionInputs: [],
  },
  partitions: [
    {
      path: "src/a.ts",
      inputHash,
      symbols: [
        {
          id: "A",
          name: "A",
          kind: "class",
          definition: location,
          extent: location,
          declarationHash: "decl",
          provenance,
        },
      ],
      edges: [
        {
          id: "call-A",
          kind: "call",
          source: location,
          sourceSymbolId: "A",
          targetSymbolId: "A",
          resolution: "resolved",
          provenance,
        },
      ],
      coverage: {
        path: "src/a.ts",
        status: "complete",
        capabilities: [
          { kind: "call", fidelity: "semantic", status: "available" },
        ],
      },
    },
  ],
});

function makeLegacyV1(path: string, version: 1 | 2 = 1): { first: string; second: string } {
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE code_head(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation TEXT NOT NULL);
      CREATE TABLE code_manifests(generation TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL) STRICT;
      CREATE TABLE code_writer_leases(scope TEXT PRIMARY KEY, token TEXT NOT NULL, expires_ms INTEGER NOT NULL) STRICT;
      CREATE TABLE code_generation_pins(generation TEXT NOT NULL REFERENCES code_manifests(generation), token TEXT NOT NULL, expires_ms INTEGER NOT NULL, PRIMARY KEY(generation,token)) STRICT, WITHOUT ROWID;
      CREATE TABLE code_retained_pins(generation TEXT NOT NULL REFERENCES code_manifests(generation), owner TEXT NOT NULL, PRIMARY KEY(generation,owner)) STRICT, WITHOUT ROWID;
      CREATE TABLE code_partitions(digest TEXT PRIMARY KEY, path TEXT NOT NULL, input_hash TEXT NOT NULL, coverage_json TEXT NOT NULL) STRICT;
      CREATE TABLE code_manifest_partitions(generation TEXT NOT NULL REFERENCES code_manifests(generation), path TEXT NOT NULL, digest TEXT NOT NULL REFERENCES code_partitions(digest), PRIMARY KEY(generation,path)) STRICT, WITHOUT ROWID;
      CREATE TABLE code_symbols(digest TEXT NOT NULL REFERENCES code_partitions(digest), id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL, start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL, extent_end INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(digest,id)) STRICT${version === 1 ? ", WITHOUT ROWID" : ""};
      CREATE INDEX code_symbols_id ON code_symbols(id,digest);
      CREATE INDEX code_symbols_path ON code_symbols(path,id,digest);
      CREATE INDEX code_symbols_name ON code_symbols(name,id,digest);
      CREATE INDEX code_symbols_position ON code_symbols(path,start_offset,end_offset,digest);
      CREATE TABLE code_edges(digest TEXT NOT NULL REFERENCES code_partitions(digest), id TEXT NOT NULL, kind TEXT NOT NULL, source_path TEXT NOT NULL, source_symbol TEXT, target_symbol TEXT, target_path TEXT, value TEXT NOT NULL, PRIMARY KEY(digest,id)) STRICT${version === 1 ? ", WITHOUT ROWID" : ""};
      CREATE INDEX code_edges_target ON code_edges(kind,target_symbol,id,digest);
      CREATE INDEX code_edges_source ON code_edges(kind,source_path,id,digest);
      CREATE INDEX code_edges_source_symbol ON code_edges(kind,source_symbol,id,digest);
      CREATE INDEX code_edges_target_path ON code_edges(kind,target_path,id,digest);
      PRAGMA user_version=${version};
    `);
    const insert = (candidate: CodeSnapshot): string => {
      const { partitions, ...metadata } = candidate;
      const entries = partitions.map((partition) => ({
        partition, digest: hashFramedDomain("projector-code-partition-v1", partition),
      }));
      const generation = hashFramedDomain("projector-code-generation-v1", {
        metadata, entries: entries.map(({ partition, digest }) => ({ path: partition.path, digest })),
      });
      db.prepare("INSERT INTO code_manifests(generation,snapshot_json) VALUES(?,?)").run(generation, canonicalJson(metadata));
      for (const { partition, digest } of entries) {
        db.prepare("INSERT INTO code_partitions(digest,path,input_hash,coverage_json) VALUES(?,?,?,?)").run(digest, partition.path, partition.inputHash, canonicalJson(partition.coverage));
        db.prepare("INSERT INTO code_manifest_partitions(generation,path,digest) VALUES(?,?,?)").run(generation, partition.path, digest);
        for (const symbol of partition.symbols)
          db.prepare("INSERT INTO code_symbols(digest,id,path,name,start_offset,end_offset,extent_end,value) VALUES(?,?,?,?,?,?,?,?)").run(digest, symbol.id, symbol.definition.path, symbol.name, symbol.definition.start, symbol.definition.end, symbol.extent.end, canonicalJson(symbol));
        for (const edge of partition.edges)
          db.prepare("INSERT INTO code_edges(digest,id,kind,source_path,source_symbol,target_symbol,target_path,value) VALUES(?,?,?,?,?,?,?,?)").run(digest, edge.id, edge.kind, edge.source.path, edge.sourceSymbolId ?? null, edge.targetSymbolId ?? null, edge.targetPath ?? null, canonicalJson(edge));
      }
      return generation;
    };
    const first = insert(snapshot("one"));
    const second = insert(snapshot("two"));
    db.prepare("INSERT INTO code_generation_pins(generation,token,expires_ms) VALUES(?,?,?)").run(first, "reader", 101);
    db.prepare("INSERT INTO code_retained_pins(generation,owner) VALUES(?,?)").run(first, "evidence:one");
    db.prepare("INSERT INTO code_head(singleton,generation) VALUES(1,?)").run(second);
    return { first, second };
  } finally {
    db.close();
  }
}

describe("immutable code index", () => {
  it("opens an already-current WAL store while another connection owns the writer lock", () => {
    const directory=mkdtempSync(join(tmpdir(),"projector-code-wal-open-"));
    try{
      const path=join(directory,"index.sqlite"),first=new SqliteCodeStore(path);
      const writer=new DatabaseSync(path);writer.exec("BEGIN IMMEDIATE");
      const second=new SqliteCodeStore(path);
      expect(second.head()).toBeNull();
      second.close();writer.exec("ROLLBACK");writer.close();first.close();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it("publishes staged partitions with the same public hashes and atomic head swap", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-"));
    try {
      const direct = new SqliteCodeStore(join(directory, "direct.sqlite"));
      const staged = new SqliteCodeStore(join(directory, "staged.sqlite"));
      const base = snapshot("first");
      const first = direct.publish(null, base);
      expect(staged.publish(null, base)).toBe(first);
      const candidate = snapshot("second");
      const expected = direct.publish(first, candidate);
      const lease = { scope: "index", token: "owner" };
      expect(staged.acquireLease(lease.scope, lease.token, 300_000)).toBe(true);
      staged.beginStage("attempt", "verified-input-identity", lease);
      staged.stagePartition("attempt", candidate.partitions[0]!, lease);
      expect(staged.head()).toBe(first);
      expect(staged.stageHasPath("attempt", "src/a.ts")).toBe(true);
      const { partitions: _partitions, ...metadata } = candidate;
      const db = new DatabaseSync(staged.path);
      db.exec("CREATE TRIGGER interrupt_stage BEFORE UPDATE ON code_head BEGIN SELECT RAISE(ABORT, 'interrupted publication'); END");
      expect(() => staged.publishStage("attempt", first, metadata, lease)).toThrow("interrupted publication");
      expect(staged.head()).toBe(first);
      expect(staged.stageHasPath("attempt", "src/a.ts")).toBe(true);
      db.exec("DROP TRIGGER interrupt_stage");
      expect(staged.publishStage("attempt", first, metadata, lease)).toBe(expected);
      expect(staged.partition(expected, "src/a.ts")).toEqual(candidate.partitions[0]);
      expect(staged.stageHasPath("attempt", "src/a.ts")).toBe(false);
      db.close(); staged.close(); direct.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("merges same-path contributions in stage and rejects a lost writer", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-merge-"));
    try {
      const store = new SqliteCodeStore(join(directory, "index.sqlite"));
      const lease = { scope: "index", token: "owner" };
      store.acquireLease(lease.scope, lease.token, 300_000);
      store.beginStage("attempt", "inputs", lease);
      const first = snapshot("same").partitions[0]!;
      const second: typeof first = {
        ...first,
        symbols: [{ ...first.symbols[0]!, name: "later" }],
        edges: [...first.edges, { ...first.edges[0]!, id: "second-edge" }],
        coverage: { ...first.coverage, status: "partial", reason: "compiler variant" },
      };
      store.stagePartition("attempt", first, lease);
      store.stagePartition("attempt", second, lease);
      expect(() => store.stagePartition("attempt", first, { ...lease, token: "intruder" })).toThrow(/lease lost/);
      const candidate = snapshot("same");
      const { partitions: _partitions, ...metadata } = candidate;
      const generation = store.publishStage("attempt", null, metadata, lease);
      const merged = store.partition(generation, first.path)!;
      expect(merged.symbols[0]!.name).toBe("later");
      expect(merged.edges.map((edge) => edge.id)).toEqual(["call-A", "second-edge"]);
      expect(merged.coverage).toMatchObject({ status: "partial", reason: "compiler variant" });
      store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("materializes provider contributions in order and requires refreshed reduction", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-contributions-"));
    try {
      const store = new SqliteCodeStore(join(directory, "index.sqlite"));
      const lease = { scope: "index", token: "owner" };
      store.acquireLease(lease.scope, lease.token, 300_000);
      store.beginStage("attempt", "inputs", lease);
      const first = snapshot("same").partitions[0]!;
      const second = {
        ...first, symbols: [{ ...first.symbols[0]!, name: "last" }],
        edges: [{ ...first.edges[0]!, id: "another-edge" }],
      };
      store.stageContributionBatch("attempt", 0, [first], lease);
      store.stageContributionBatch("attempt", 1, [second], lease);
      expect(store.contribution("attempt", 1, first.path)?.symbols[0]?.name).toBe("last");
      const { partitions: _partitions, ...metadata } = snapshot("same");
      expect(() => store.publishStage("attempt", null, metadata, lease)).toThrow(/materialized/);
      store.materializeContributions("attempt", lease);
      expect(store.stageHasPath("attempt", first.path)).toBe(true);
      const beforePublication = new DatabaseSync(store.path);
      const typedCount = (beforePublication.prepare("SELECT COUNT(*) AS count FROM code_symbols").get() as {count:number}).count;
      expect(typedCount).toBeGreaterThan(0);
      expect(beforePublication.prepare("SELECT partition_id FROM code_stage_versions WHERE stage_id='attempt'").get()).toBeDefined();
      expect(beforePublication.prepare("SELECT name FROM sqlite_master WHERE name='code_stage_partitions'").get()).toBeUndefined();
      beforePublication.close();
      store.pruneUnpinned();
      expect(store.stagedPartition("attempt",first.path)?.symbols).toHaveLength(1);
      store.replaceContribution("attempt", 1, { ...second, symbols: [{ ...second.symbols[0]!, name: "revised" }] }, lease);
      expect(() => store.publishStage("attempt", null, metadata, lease)).toThrow(/materialized/);
      store.materializeContributions("attempt", lease);
      const generation = store.publishStage("attempt", null, metadata, lease);
      const afterPublication = new DatabaseSync(store.path);
      expect((afterPublication.prepare("SELECT COUNT(*) AS count FROM code_stage_versions").get() as {count:number}).count).toBe(0);
      expect((afterPublication.prepare("SELECT COUNT(*) AS count FROM code_stage_contributions").get() as {count:number}).count).toBe(0);
      expect((afterPublication.prepare("SELECT COUNT(*) AS count FROM code_symbols").get() as {count:number}).count).toBeGreaterThanOrEqual(typedCount);
      afterPublication.close();
      const merged = store.partition(generation, first.path)!;
      expect(merged.symbols[0]!.name).toBe("revised");
      expect(merged.edges.map((edge) => edge.id)).toEqual(["another-edge", "call-A"]);
      store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("returns a committed head when post-publication spool cleanup fails and reclaims it on the next lease", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-cleanup-"));
    const store = new SqliteCodeStore(join(directory, "index.sqlite"));
    const observer = new DatabaseSync(store.path);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const lease = { scope: "index", token: "first-owner" };
      expect(store.acquireLease(lease.scope, lease.token, 300_000)).toBe(true);
      store.beginStage("first-stage", "verified-input", lease);
      const candidate = snapshot("committed-after-cleanup-error");
      store.stageContribution("first-stage", 0, candidate.partitions[0]!, lease);
      store.materializeContributions("first-stage", lease);
      observer.exec("CREATE TRIGGER fail_stage_cleanup BEFORE DELETE ON code_stage_contributions BEGIN SELECT RAISE(ABORT, 'injected cleanup failure'); END");
      const { partitions: _partitions, ...metadata } = candidate;
      const generation = store.publishStage("first-stage", null, metadata, lease);
      expect(store.head()).toBe(generation);
      expect(store.partition(generation, candidate.partitions[0]!.path)).toEqual(candidate.partitions[0]);
      expect(store.stageHasPath("first-stage", candidate.partitions[0]!.path)).toBe(true);
      expect(JSON.parse(String(warning.mock.calls[0]?.[0]))).toMatchObject({
        event: "code-stage-cleanup-failed",
        stageId: "first-stage",
        generation,
        error: expect.stringContaining("injected cleanup failure"),
      });

      observer.exec("DROP TRIGGER fail_stage_cleanup");
      store.releaseLease(lease.scope, lease.token);
      const successor = { scope: "index", token: "next-owner" };
      expect(store.acquireLease(successor.scope, successor.token, 300_000)).toBe(true);
      store.beginStage("next-stage", "new-input", successor);
      expect(store.stageHasPath("first-stage", candidate.partitions[0]!.path)).toBe(false);
      expect((observer.prepare("SELECT COUNT(*) AS count FROM code_stage_contributions WHERE stage_id='first-stage'").get() as { count: number }).count).toBe(0);
      expect(store.head()).toBe(generation);
      expect(store.partition(generation, candidate.partitions[0]!.path)).toEqual(candidate.partitions[0]);
    } finally {
      warning.mockRestore();
      observer.close(); store.close(); rmSync(directory, { recursive: true, force: true });
    }
  });
  it("uses the existing locale path precedence for staged symbol lookup", () => {
    const directory=mkdtempSync(join(tmpdir(),"projector-code-stage-symbol-order-"));
    try{
      const store=new SqliteCodeStore(join(directory,"index.sqlite"));
      const lease={scope:"index",token:"owner"};store.acquireLease(lease.scope,lease.token,300_000);
      store.beginStage("attempt","inputs",lease);
      const base=snapshot("same").partitions[0]!;
      for(const path of ["src/Z.ts","src/a.ts"]){
        const definition={...location,path};
        store.stagePartition("attempt",{...base,path,coverage:{...base.coverage,path},symbols:[{...base.symbols[0]!,definition,extent:definition}],edges:[]},lease);
      }
      const expected=["src/Z.ts","src/a.ts"].sort((a,b)=>a.localeCompare(b)).at(-1)!;
      expect(store.stagedSymbol("attempt","A")?.path).toBe(expected);
      expect(store.stagedSymbol("attempt","A")?.definition.path).toBe(expected);
      store.close();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it("keeps the visible head when a staged writer loses its lease", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-lease-"));
    try {
      const store = new SqliteCodeStore(join(directory, "index.sqlite"));
      const first = store.publish(null, snapshot("first"));
      const lease = { scope: "index", token: "first-writer" };
      expect(store.acquireLease(lease.scope, lease.token, 300_000)).toBe(true);
      store.beginStage("abandoned", "verified-input", lease);
      const candidate = snapshot("second");
      store.stageContribution("abandoned", 0, candidate.partitions[0]!, lease);
      store.materializeContributions("abandoned", lease);
      const db = new DatabaseSync(store.path);
      db.prepare("UPDATE code_writer_leases SET expires_ms=0 WHERE scope=?").run(lease.scope);
      const { partitions: _partitions, ...metadata } = candidate;
      const replacement = { scope: "index", token: "replacement" };
      expect(store.acquireLease(replacement.scope, replacement.token, 300_000)).toBe(true);
      expect(() => store.publishStage("abandoned", first, metadata, lease)).toThrow(/lease lost/);
      expect(store.head()).toBe(first);
      store.beginStage("replacement", "same-verified-input", replacement);
      expect(store.stageHasPath("abandoned", candidate.partitions[0]!.path)).toBe(false);
      store.stagePartition("replacement", candidate.partitions[0]!, replacement);
      expect(store.publishStage("replacement", first, metadata, replacement)).toBeTruthy();
      db.close(); store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("renews an expired uncontested token and fences a replacement writer", () => {
    const directory=mkdtempSync(join(tmpdir(),"projector-code-lease-renew-"));
    try{
      const store=new SqliteCodeStore(join(directory,"index.sqlite"));
      const owner={scope:"index",token:"owner"};
      expect(store.acquireLease(owner.scope,owner.token,300_000)).toBe(true);
      store.beginStage("attempt","verified-input",owner);
      const db=new DatabaseSync(store.path);
      db.prepare("UPDATE code_writer_leases SET expires_ms=0 WHERE scope=?").run(owner.scope);
      store.heartbeatLease(owner.scope,owner.token,300_000);
      const renewed=db.prepare("SELECT expires_ms FROM code_writer_leases WHERE scope=?").get(owner.scope) as {expires_ms:number};
      expect(renewed.expires_ms).toBeGreaterThan(Date.now());
      const candidate=snapshot("uncontested"),{partitions:_parts,...metadata}=candidate;
      store.stagePartition("attempt",candidate.partitions[0]!,owner);
      expect(store.publishStage("attempt",null,metadata,owner)).toBeTruthy();
      db.prepare("UPDATE code_writer_leases SET expires_ms=0 WHERE scope=?").run(owner.scope);
      expect(store.acquireLease(owner.scope,"replacement",300_000)).toBe(true);
      expect(()=>store.heartbeatLease(owner.scope,owner.token,300_000)).toThrow("lease lost");
      db.close();store.close();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it("commits an already-locked publication when its token expires inside the transaction", () => {
    const directory=mkdtempSync(join(tmpdir(),"projector-code-lease-in-transaction-"));
    try{
      const store=new SqliteCodeStore(join(directory,"index.sqlite"));
      const first=store.publish(null,snapshot("first"));
      const lease={scope:"index",token:"owner"};store.acquireLease(lease.scope,lease.token,300_000);
      store.beginStage("attempt","verified-input",lease);
      const candidate=snapshot("second"),{partitions:_parts,...metadata}=candidate;
      store.stagePartition("attempt",candidate.partitions[0]!,lease);
      const db=new DatabaseSync(store.path);
      db.exec("CREATE TRIGGER expire_code_lease BEFORE UPDATE ON code_head BEGIN UPDATE code_writer_leases SET expires_ms=0 WHERE scope='index'; END");
      const second=store.publishStage("attempt",first,metadata,lease);
      expect(store.head()).toBe(second);
      store.heartbeatLease(lease.scope,lease.token,300_000);
      expect((db.prepare("SELECT expires_ms FROM code_writer_leases WHERE scope='index'").get() as {expires_ms:number}).expires_ms).toBeGreaterThan(Date.now());
      db.close();store.close();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it("reduces more than one bounded stage page without losing a path", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-pages-"));
    try {
      const store = new SqliteCodeStore(join(directory, "index.sqlite"));
      const lease = { scope: "index", token: "owner" };
      store.acquireLease(lease.scope, lease.token, 300_000);
      store.beginStage("many", "verified-input", lease);
      const partitions = Array.from({ length: 130 }, (_, index) => {
        const path = `src/${index.toString().padStart(3, "0")}.ts`;
        return { path, inputHash: "same", symbols: [], edges: [], coverage: {
          path, status: "partial" as const, capabilities: [],
        } };
      });
      store.stageContributionBatch("many", 0, partitions, lease);
      store.materializeContributions("many", lease);
      expect([...store.stagedPaths("many")]).toEqual(partitions.map((partition) => partition.path));
      expect(store.stagedPartition("many", partitions.at(-1)!.path)).toEqual(partitions.at(-1));
      store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("uses the legacy path order when a bridge symbol ID occurs in two partitions", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-stage-symbols-"));
    try {
      const store = new SqliteCodeStore(join(directory, "index.sqlite"));
      const lease = { scope: "index", token: "owner" };
      store.acquireLease(lease.scope, lease.token, 300_000);
      store.beginStage("symbols", "verified-input", lease);
      const source = snapshot("same").partitions[0]!;
      const paths = ["src/a.ts", "src/B.ts"];
      for (const path of paths)
        store.stagePartition("symbols", { ...source, path, coverage: { ...source.coverage, path },
          symbols: source.symbols.map((symbol) => ({ ...symbol,
            definition: { ...symbol.definition, path }, extent: { ...symbol.extent, path },
          })), edges: [] }, lease);
      const expectedPath = paths.sort((a, b) => a.localeCompare(b)).at(-1)!;
      expect(store.stagedSymbol("symbols", source.symbols[0]!.id)?.definition.path).toBe(expectedPath);
      store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("pages equal public IDs in distinct partitions without skipping a fact", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-tied-ids-"));
    try {
      const store = new SqliteCodeStore(join(directory, "code.sqlite"));
      const base = snapshot("same-id");
      const first = base.partitions[0]!;
      const second = {
        ...first, path: "src/b.ts", inputHash: "second",
        coverage: { ...first.coverage, path: "src/b.ts" },
        symbols: first.symbols.map((symbol) => ({ ...symbol, provenance: { ...symbol.provenance, artifact: "second" } })),
        edges: first.edges.map((edge) => ({ ...edge, provenance: { ...edge.provenance, artifact: "second" } })),
      };
      const generation = store.publish(null, { ...base, partitions: [first, second] });
      const common = { schemaVersion: "projector.code-query/v1" as const, generation, limit: 1 };
      for (const input of [
        { ...common, kind: "definition" as const, symbolId: "A" },
        { ...common, kind: "call" as const, direction: "outgoing" as const, path: "src/a.ts" },
        { ...common, kind: "call" as const, direction: "incoming" as const, path: "src/a.ts" },
      ]) {
        const pageOne = store.query(input);
        const pageTwo = store.query({ ...input, cursor: pageOne.nextCursor });
        const facts = input.kind === "definition"
          ? [...pageOne.symbols, ...pageTwo.symbols]
          : [...pageOne.edges, ...pageTwo.edges];
        expect(facts).toHaveLength(2);
        expect(facts.map((fact) => fact.provenance.artifact)).toEqual([undefined, "second"]);
        expect(pageTwo.nextCursor).toBeUndefined();
      }
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("round trips typed facts, optional fields, external endpoints, and text ordered cursors", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-normalized-"));
    try {
      const path = join(directory, "code.sqlite");
      const store = new SqliteCodeStore(path);
      const base = snapshot("typed");
      const symbol = {
        ...base.partitions[0]!.symbols[0]!, id: "z-public", typeDisplay: "T", bodyHash: "body",
        extent: { ...location, path: "src/extent.ts", end: 4 },
        provenance: { ...provenance, artifact: "semantic.scip" },
      };
      const source = { ...location, path: "src/b.ts" };
      const candidate: CodeSnapshot = {
        ...base,
        partitions: [
          { ...base.partitions[0]!, symbols: [symbol], edges: [] },
          {
            path: "src/b.ts", inputHash: "b", symbols: [],
            edges: [
              { id: "z-edge", kind: "reference", source, sourceSymbolId: "external::source", targetSymbolId: "z-public", resolution: "resolved", provenance: { ...provenance, artifact: "semantic.scip" } },
              { id: "a-edge", kind: "reference", source, targetPath: "src/a.ts", resolution: "resolved", provenance },
              { id: "m-edge", kind: "reference", source, sourceSymbolId: "external::source", targetSymbolId: "external::target", resolution: "resolved", provenance },
              { id: "u-edge", kind: "reference", source, resolution: "unresolved", provenance },
            ],
            coverage: { path: "src/b.ts", status: "complete", capabilities: [] },
          },
        ],
      };
      const generation = store.publish(null, candidate);
      expect(store.partition(generation, "src/a.ts")!.symbols).toEqual([symbol]);
      expect(store.partition(generation, "src/b.ts")!.edges).toEqual([...candidate.partitions[1]!.edges].sort((a, b) => a.id.localeCompare(b.id)));
      expect(store.symbolAt(generation, "src/a.ts", 0)).toEqual(symbol);
      const outgoing = { schemaVersion: "projector.code-query/v1" as const, generation, kind: "reference" as const, direction: "outgoing" as const, path: "src/b.ts", limit: 2 };
      const first = store.query(outgoing);
      expect(first.edges.map((edge) => edge.id)).toEqual(["a-edge", "m-edge"]);
      expect(store.query({ ...outgoing, cursor: first.nextCursor }).edges.map((edge) => edge.id)).toEqual(["u-edge", "z-edge"]);
      const incoming = { ...outgoing, direction: "incoming" as const, path: "src/a.ts", limit: 1 };
      const firstIncoming = store.query(incoming);
      expect(firstIncoming.edges.map((edge) => edge.id)).toEqual(["a-edge"]);
      expect(store.query({ ...incoming, cursor: firstIncoming.nextCursor }).edges.map((edge) => edge.id)).toEqual(["z-edge"]);
      expect(store.query({ ...outgoing, direction: "incoming", symbolId: "external::target", path: undefined }).edges.map((edge) => edge.id)).toEqual(["m-edge"]);
      expect(store.neighborhood(generation, "src/a.ts").incoming.map((edge) => edge.id)).toEqual(["a-edge", "z-edge"]);
      const db = new DatabaseSync(path);
      for (const table of ["code_symbols", "code_edges"])
        expect(db.prepare(`SELECT name FROM pragma_table_info(?) WHERE name='value'`).get(table)).toBeUndefined();
      db.close();
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("migrates a rowid v2 store and keeps its pinned prior generation", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-v2-"));
    try {
      const path = join(directory, "code.sqlite");
      const { first, second } = makeLegacyV1(path, 2);
      const store = new SqliteCodeStore(path);
      expect(store.head()).toBe(second);
      expect(store.partition(first, "src/a.ts")?.symbols[0]?.id).toBe("A");
      expect(store.pruneUnpinned(200)).toBe(0);
      expect(store.publish(second, snapshot("third"))).toBeTruthy();
      expect(store.hasGeneration(first)).toBe(true);
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("rolls back incomplete first initialization and can retry", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-init-"));
    try {
      const path = join(directory, "code.sqlite");
      const obstacle = new DatabaseSync(path);
      obstacle.exec("CREATE TABLE code_manifests(blocker TEXT)");
      obstacle.close();
      expect(() => new SqliteCodeStore(path)).toThrow(/code_manifests already exists/);
      const check = new DatabaseSync(path);
      expect((check.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(0);
      expect(check.prepare("SELECT name FROM sqlite_master WHERE name='code_head'").get()).toBeUndefined();
      check.exec("DROP TABLE code_manifests");
      check.close();
      const initialized = new SqliteCodeStore(path);
      expect(initialized.publish(null, snapshot("one"))).toBeTruthy();
      initialized.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("reports SQLite capacity failure without losing the prior head", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-full-"));
    try {
      const path = join(directory, "code.sqlite");
      const store = new SqliteCodeStore(path);
      const first = store.publish(null, snapshot("one"));
      const db = (store as unknown as { db: DatabaseSync }).db;
      const pages = (db.prepare("PRAGMA page_count").get() as { page_count: number }).page_count;
      const originalLimit = (db.prepare("PRAGMA max_page_count").get() as { max_page_count: number }).max_page_count;
      db.exec(`PRAGMA max_page_count=${pages + 1}`);
      const oversized = snapshot("large".repeat(20_000));
      expect(() => store.publish(first, oversized)).toThrow(/database or disk is full/i);
      expect(store.head()).toBe(first);
      expect(store.partition(first, "src/a.ts")?.inputHash).toBe("one");
      db.exec(`PRAGMA max_page_count=${originalLimit}`);
      expect(store.publish(first, snapshot("two"))).toBeTruthy();
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("migrates a pinned v1 store atomically and preserves a failed attempt", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-v1-"));
    try {
      const path = join(directory, "code.sqlite");
      const { first, second } = makeLegacyV1(path);

      const obstacle = new DatabaseSync(path);
      obstacle.exec("CREATE TABLE code_paths(blocker TEXT)");
      obstacle.close();
      expect(() => new SqliteCodeStore(path)).toThrow(/code_paths already exists/);
      const unchanged = new DatabaseSync(path);
      expect((unchanged.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(1);
      expect((unchanged.prepare("SELECT generation FROM code_head").get() as { generation: string }).generation).toBe(second);
      expect((unchanged.prepare("SELECT wr FROM pragma_table_list WHERE name='code_edges'").get() as { wr: number }).wr).toBe(1);
      unchanged.exec("DROP TABLE code_paths");
      unchanged.close();

      const migrated = new SqliteCodeStore(path);
      expect(migrated.head()).toBe(second);
      expect(migrated.partition(first, "src/a.ts")?.inputHash).toBe("one");
      expect(migrated.partition(second, "src/a.ts")?.inputHash).toBe("two");
      const third = migrated.publish(second, snapshot("three"));
      expect(migrated.hasGeneration(first)).toBe(true);
      migrated.close();
      const check = new DatabaseSync(path);
      expect((check.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(4);
      for (const table of ["code_edges", "code_symbols"])
        expect((check.prepare("SELECT wr FROM pragma_table_list WHERE name=?").get(table) as { wr: number }).wr).toBe(1);
      expect((check.prepare("SELECT generation FROM code_head").get() as { generation: string }).generation).toBe(third);
      expect(check.prepare("PRAGMA foreign_key_check").get()).toBeUndefined();
      check.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("migrates v3 staging without erasing an already-open older writer", () => {
    const directory=mkdtempSync(join(tmpdir(),"projector-code-live-v3-"));
    try{
      const path=join(directory,"index.sqlite"),initial=new SqliteCodeStore(path);
      initial.close();
      const old=new DatabaseSync(path);
      old.exec(`
        PRAGMA foreign_keys=ON;
        ALTER TABLE code_stages DROP COLUMN dirty;
        CREATE TABLE code_stage_partitions(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id),path TEXT NOT NULL,sort_key BLOB NOT NULL,digest TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(stage_id,path)) STRICT, WITHOUT ROWID;
        CREATE TABLE code_stage_symbols(stage_id TEXT NOT NULL REFERENCES code_stages(stage_id),id TEXT NOT NULL,path TEXT NOT NULL,definition_json TEXT NOT NULL,PRIMARY KEY(stage_id,id,path)) STRICT, WITHOUT ROWID;
        PRAGMA user_version=3;
      `);
      const candidate=snapshot("older-runtime"),partition=candidate.partitions[0]!;
      const digest=hashFramedDomain("projector-code-partition-v1",partition);
      old.prepare("INSERT INTO code_writer_leases VALUES(?,?,?)").run("index","old-owner",Date.now()+300_000);
      old.prepare("INSERT INTO code_stages(stage_id,source_identity,lease_scope,lease_token) VALUES(?,?,?,?)").run("old-stage","bound-input","index","old-owner");
      old.prepare("INSERT INTO code_stage_partitions VALUES(?,?,?,?,?)").run("old-stage",partition.path,Buffer.from(partition.path,"utf16le").swap16(),digest,canonicalJson(partition));
      const upgraded=new SqliteCodeStore(path);
      expect((old.prepare("PRAGMA user_version").get() as {user_version:number}).user_version).toBe(4);
      expect((old.prepare("SELECT dirty FROM code_stages WHERE stage_id='old-stage'").get() as {dirty:number}).dirty).toBe(0);
      expect(old.prepare("SELECT value FROM code_stage_partitions WHERE stage_id='old-stage'").get()).toBeDefined();
      const {partitions:_partitions,...metadata}=candidate;
      const generation=hashFramedDomain("projector-code-generation-v1",{metadata,entries:[{path:partition.path,digest}]});
      old.exec("BEGIN IMMEDIATE");
      try{
        const partitionId=new CodeFactWriter(old).insert(partition,digest);
        old.prepare("INSERT INTO code_manifests VALUES(?,?)").run(generation,canonicalJson(metadata));
        old.prepare("INSERT INTO code_manifest_partitions VALUES(?,?,?)").run(generation,partition.path,partitionId);
        old.prepare("INSERT INTO code_head VALUES(1,?)").run(generation);
        old.prepare("DELETE FROM code_stage_partitions WHERE stage_id='old-stage'").run();
        old.prepare("DELETE FROM code_stages WHERE stage_id='old-stage'").run();
        old.exec("COMMIT");
      }catch(error){old.exec("ROLLBACK");throw error;}
      expect(upgraded.head()).toBe(generation);
      expect(upgraded.partition(generation,partition.path)).toEqual(partition);
      expect(old.prepare("PRAGMA foreign_key_check").get()).toBeUndefined();
      old.close();upgraded.close();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it("preserves the original error when SQLite automatically rolls back publication", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-autorevert-"));
    try {
      const path = join(directory, "code.sqlite");
      const store = new SqliteCodeStore(path);
      const setup = new DatabaseSync(path);
      setup.exec("CREATE TRIGGER force_publish_rollback BEFORE INSERT ON code_manifests BEGIN SELECT RAISE(ROLLBACK, 'forced publication rollback'); END");
      setup.close();
      expect(() => store.publish(null, snapshot("one"))).toThrow("forced publication rollback");
      expect(store.head()).toBeNull();
      const recovery = new DatabaseSync(path);
      recovery.exec("DROP TRIGGER force_publish_rollback");
      recovery.close();
      expect(store.publish(null, snapshot("one"))).toBeTruthy();
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("keeps a generation readable across a competing publication", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-read-"));
    try {
      const path = join(directory, "code.sqlite");
      const writer = new SqliteCodeStore(path);
      const first = writer.publish(null, snapshot("one"));
      const second = writer.publish(first, snapshot("two"));
      const reader = new SqliteCodeStore(path);
      reader.beginReadSnapshot();
      expect(reader.head()).toBe(second);
      expect(reader.partition(first, "src/a.ts")?.inputHash).toBe("one");
      const third = writer.publish(second, snapshot("three"));
      expect(reader.head()).toBe(second);
      expect(reader.partition(first, "src/a.ts")?.inputHash).toBe("one");
      reader.endReadSnapshot();
      expect(() =>
        reader.withReadSnapshot(() => {
          throw new Error("reader failed");
        }),
      ).toThrow("reader failed");
      expect(writer.head()).toBe(third);
      expect(writer.hasGeneration(first)).toBe(false);
      reader.close();
      writer.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("reclaims unpinned generations during publication and preserves pins until release", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-reclaim-"));
    try {
      const store = new SqliteCodeStore(join(directory, "code.sqlite"));
      const first = store.publish(null, snapshot("one"));
      store.pin(first, "request", 1, 100);
      const second = store.publish(first, snapshot("two"));
      store.pinRetained(second, "impact:one");
      const third = store.publish(second, snapshot("three"));
      const fourth = store.publish(third, snapshot("four"));
      expect(store.hasGeneration(first)).toBe(true);
      expect(store.hasGeneration(second)).toBe(true);
      expect(store.hasGeneration(third)).toBe(true);
      expect(store.hasGeneration(fourth)).toBe(true);
      expect(store.pruneUnpinned(10_000)).toBe(0);

      store.unpin(first, "request");
      store.releaseRetained(second, "impact:one");
      expect(() => store.publish("stale-head", snapshot("five"))).toThrow(
        /head changed/,
      );
      expect(store.hasGeneration(first)).toBe(true);
      expect(store.hasGeneration(second)).toBe(true);
      const invalid = snapshot("invalid");
      const duplicated: CodeSnapshot = {
        ...invalid,
        partitions: invalid.partitions.map((partition) => ({
          ...partition,
          symbols: [...partition.symbols, ...partition.symbols],
        })),
      };
      expect(() => store.publish(fourth, duplicated)).toThrow();
      expect(store.head()).toBe(fourth);
      expect(store.hasGeneration(first)).toBe(true);
      expect(store.hasGeneration(second)).toBe(true);
      const fifth = store.publish(fourth, snapshot("five"));
      expect(store.hasGeneration(first)).toBe(false);
      expect(store.hasGeneration(second)).toBe(false);
      expect(store.hasGeneration(third)).toBe(false);
      expect(store.hasGeneration(fourth)).toBe(true);
      expect(store.hasGeneration(fifth)).toBe(true);
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("waits for a prior SQLite writer before claiming a semantic lease", async () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-lease-admission-"));
    const store = new SqliteCodeStore(join(directory, "code.sqlite"));
    const writer = new DatabaseSync(store.path);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      writer.exec("BEGIN IMMEDIATE");
      const release = setTimeout(() => writer.exec("COMMIT"), 100);
      try {
        expect(await store.acquireLeaseWhenReady("index", "waiting-owner", 300_000)).toBe(true);
      } finally {
        clearTimeout(release);
      }
      expect(store.acquireLease("index", "other-owner", 300_000)).toBe(false);
    } finally {
      warning.mockRestore();
      if (writer.isTransaction) writer.exec("ROLLBACK");
      writer.close(); store.close(); rmSync(directory, { recursive: true, force: true });
    }
  });
  it("keeps addressed old generations and enforces head CAS", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-"));
    try {
      const store = new SqliteCodeStore(join(directory, "code.sqlite"));
      const first = store.publish(null, snapshot("one"));
      const firstVersion = store.dependencyVersion(first, "src/a.ts");
      const second = store.publish(first, snapshot("two"));
      expect(store.head()).toBe(second);
      expect(store.dependencyVersion(second, "src/a.ts")).not.toBe(
        firstVersion,
      );
      expect(store.partition(first, "src/a.ts")?.inputHash).toBe("one");
      expect(store.partition(second, "src/a.ts")?.inputHash).toBe("two");
      expect(
        store.query({
          schemaVersion: "projector.code-query/v1",
          generation: first,
          kind: "call",
          direction: "outgoing",
          symbolId: "A",
        }).edges,
      ).toHaveLength(1);
      expect(
        store.query({
          schemaVersion: "projector.code-query/v1",
          generation: first,
          kind: "call",
          path: "src/a.ts",
        }).edges,
      ).toHaveLength(1);
      expect(() => store.publish(first, snapshot("three"))).toThrow(
        /head changed/,
      );
      expect(store.head()).toBe(second);
      expect(store.acquireLease("project", "owner-a", 1000, 100)).toBe(true);
      expect(store.acquireLease("project", "owner-b", 1000, 100)).toBe(false);
      expect(() =>
        store.publish(second, snapshot("three"), {
          scope: "project",
          token: "owner-b",
        }),
      ).toThrow(/lease lost/);
      store.pin(first, "reader", 1000, 100);
      store.pinRetained(first, "impact:one");
      const third = store.publish(second, snapshot("three"));
      expect(store.pruneUnpinned(200)).toBe(0);
      store.unpin(first, "reader");
      expect(store.pruneUnpinned(200)).toBe(0);
      store.releaseRetained(first, "impact:one");
      expect(store.pruneUnpinned(200)).toBe(1);
      expect(store.head()).toBe(third);
      expect(store.hasGeneration(first)).toBe(false);
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("resolves symbol-only neighbors and definitions at references", () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-code-neighbors-"));
    try {
      const store = new SqliteCodeStore(join(directory, "code.sqlite"));
      const base = snapshot("one");
      const caller = {
        path: "src/b.ts",
        start: 10,
        end: 11,
        line: 1,
        column: 11,
      };
      const candidate: CodeSnapshot = {
        ...base,
        partitions: [
          ...base.partitions,
          {
            path: "src/b.ts",
            inputHash: "two",
            symbols: [],
            edges: [
              {
                id: "reference-B-A",
                kind: "reference",
                source: caller,
                targetSymbolId: "A",
                resolution: "resolved",
                provenance,
              },
            ],
            coverage: {
              path: "src/b.ts",
              status: "complete",
              capabilities: [],
            },
          },
        ],
      };
      const first = store.publish(null, candidate);
      expect(store.symbolAt(first, "src/b.ts", 10)?.id).toBe("A");
      expect(store.neighborhood(first, "src/b.ts").relatedPaths).toEqual([
        "src/a.ts",
      ]);
      expect(
        store.partition(first, "src/b.ts")?.edges[0]?.targetPath,
      ).toBeUndefined();
      const firstVersion = store.dependencyVersion(first, "src/a.ts");
      const emptyVersion = store.dependencyVersion(first, "src/missing.ts");
      const unrelated: CodeSnapshot = {
        ...candidate,
        partitions: [
          ...candidate.partitions,
          {
            path: "src/c.ts",
            inputHash: "three",
            symbols: [],
            edges: [],
            coverage: {
              path: "src/c.ts",
              status: "complete",
              capabilities: [],
            },
          },
        ],
      };
      const second = store.publish(first, unrelated);
      expect(store.dependencyVersion(second, "src/a.ts")).toBe(firstVersion);
      expect(store.dependencyVersion(second, "src/missing.ts")).toBe(
        emptyVersion,
      );
      const related: CodeSnapshot = {
        ...unrelated,
        partitions: [
          ...unrelated.partitions.slice(0, 2),
          {
            ...unrelated.partitions[2]!,
            edges: [
              {
                id: "reference-C-A",
                kind: "reference",
                source: {
                  path: "src/c.ts",
                  start: 2,
                  end: 3,
                  line: 1,
                  column: 3,
                },
                targetSymbolId: "A",
                resolution: "resolved",
                provenance,
              },
            ],
          },
        ],
      };
      const third = store.publish(second, related);
      expect(store.dependencyVersion(third, "src/a.ts")).not.toBe(firstVersion);
      const newIncoming: CodeSnapshot = {
        ...related,
        partitions: [
          ...related.partitions.slice(0, 2),
          {
            ...related.partitions[2]!,
            edges: [
              ...related.partitions[2]!.edges,
              {
                id: "reference-C-missing",
                kind: "reference",
                source: {
                  path: "src/c.ts",
                  start: 4,
                  end: 5,
                  line: 1,
                  column: 5,
                },
                targetPath: "src/missing.ts",
                resolution: "resolved",
                provenance,
              },
            ],
          },
        ],
      };
      const fourth = store.publish(third, newIncoming);
      expect(store.dependencyVersion(fourth, "src/missing.ts")).not.toBe(
        emptyVersion,
      );
      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
