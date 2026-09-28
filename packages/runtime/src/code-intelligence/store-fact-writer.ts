import { DatabaseSync, type StatementSync } from "node:sqlite";
import { canonicalJson, type CodePartition, type CodeProvenance } from "@projector/core";

/** One transaction's prepared writer. Only interned keys remain resident across files. */
export class CodeFactWriter {
  private readonly insertPath: StatementSync;
  private readonly pathKey: StatementSync;
  private readonly insertIdentity: StatementSync;
  private readonly identityKey: StatementSync;
  private readonly insertProvenance: StatementSync;
  private readonly provenanceKey: StatementSync;
  private readonly insertPartition: StatementSync;
  private readonly partitionKey: StatementSync;
  private readonly insertSymbol: StatementSync;
  private readonly insertEdge: StatementSync;
  private readonly paths = new Map<string, number>();
  private readonly identities = new Map<string, number>();
  private readonly provenances = new Map<string, number>();

  constructor(db: DatabaseSync) {
    this.insertPath = db.prepare("INSERT OR IGNORE INTO code_paths(path) VALUES(?)");
    this.pathKey = db.prepare("SELECT path_id FROM code_paths WHERE path=?");
    this.insertIdentity = db.prepare("INSERT OR IGNORE INTO code_identities(id) VALUES(?)");
    this.identityKey = db.prepare("SELECT identity_id FROM code_identities WHERE id=?");
    this.insertProvenance = db.prepare("INSERT OR IGNORE INTO code_provenances(value,provider,version,input_hash,artifact) VALUES(?,?,?,?,?)");
    this.provenanceKey = db.prepare("SELECT provenance_id FROM code_provenances WHERE value=?");
    this.insertPartition = db.prepare("INSERT OR IGNORE INTO code_partitions(digest,path_id,input_hash,coverage_json) VALUES(?,?,?,?)");
    this.partitionKey = db.prepare("SELECT partition_id FROM code_partitions WHERE digest=?");
    this.insertSymbol = db.prepare("INSERT INTO code_symbols(partition_id,id,identity_id,name,kind,definition_path_id,definition_start,definition_end,definition_line,definition_column,extent_path_id,extent_start,extent_end,extent_line,extent_column,type_display,declaration_hash,body_hash,provenance_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    this.insertEdge = db.prepare("INSERT INTO code_edges(partition_id,id,kind,source_path_id,source_start,source_end,source_line,source_column,source_identity_id,target_identity_id,target_path_id,resolution,provenance_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
  }

  private path(path: string): number {
    let key = this.paths.get(path);
    if (key === undefined) {
      this.insertPath.run(path);
      key = Number((this.pathKey.get(path) as { path_id: number }).path_id);
      this.paths.set(path, key);
    }
    return key;
  }
  private identity(id: string | undefined): number | null {
    if (id === undefined) return null;
    let key = this.identities.get(id);
    if (key === undefined) {
      this.insertIdentity.run(id);
      key = Number((this.identityKey.get(id) as { identity_id: number }).identity_id);
      this.identities.set(id, key);
    }
    return key;
  }
  private provenance(provenance: CodeProvenance): number {
    const value = canonicalJson(provenance);
    let key = this.provenances.get(value);
    if (key === undefined) {
      this.insertProvenance.run(value, provenance.provider, provenance.version, provenance.inputHash, provenance.artifact ?? null);
      key = Number((this.provenanceKey.get(value) as { provenance_id: number }).provenance_id);
      this.provenances.set(value, key);
    }
    return key;
  }
  insert(partition: CodePartition, digest: string): number {
    const inserted = this.insertPartition.run(digest, this.path(partition.path), partition.inputHash, canonicalJson(partition.coverage));
    const partitionId = (this.partitionKey.get(digest) as { partition_id: number }).partition_id;
    if (inserted.changes !== 1) return partitionId;
    for (const symbol of partition.symbols)
      this.insertSymbol.run(
        partitionId, symbol.id, this.identity(symbol.id), symbol.name, symbol.kind,
        this.path(symbol.definition.path), symbol.definition.start, symbol.definition.end,
        symbol.definition.line, symbol.definition.column, this.path(symbol.extent.path),
        symbol.extent.start, symbol.extent.end, symbol.extent.line, symbol.extent.column,
        symbol.typeDisplay ?? null, symbol.declarationHash, symbol.bodyHash ?? null,
        this.provenance(symbol.provenance),
      );
    for (const edge of partition.edges)
      this.insertEdge.run(
        partitionId, edge.id, edge.kind, this.path(edge.source.path), edge.source.start,
        edge.source.end, edge.source.line, edge.source.column,
        this.identity(edge.sourceSymbolId), this.identity(edge.targetSymbolId),
        edge.targetPath === undefined ? null : this.path(edge.targetPath),
        edge.resolution, this.provenance(edge.provenance),
      );
    return partitionId;
  }
}
