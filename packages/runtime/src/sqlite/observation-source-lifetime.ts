import { toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ObservationBudget } from "@projector/core";
import { removeAbandonedObservationTemporaryFiles } from "./observation-temporary-files.js";

/** SQLite and the OS release reader ownership on process death without persisted owner records. */
export const sourceLifetimePath = (indexPath: string): string => `${indexPath}.source-lifetime.sqlite`;

function isBusy(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_SQLITE_ERROR" && /database is locked|SQLITE_BUSY/.test(error.message);
}

export class SourceLifetimeReader {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(indexPath: string) {
    this.database = new DatabaseSync(toNamespacedPath(sourceLifetimePath(indexPath)), { timeout: 0 });
    try {
      const mode = this.database.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      if (mode.journal_mode !== "delete") throw new Error("Source lifetime database must use rollback journal mode");
      this.database.exec("BEGIN");
      // BEGIN is deferred. Reading the schema obtains a SHARED lock for the lifetime of this owner.
      this.database.prepare("SELECT COUNT(*) AS count FROM sqlite_schema").get();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  static async acquire(indexPath:string,budget?:ObservationBudget,signal?:AbortSignal):Promise<SourceLifetimeReader> {
    while(true) {
      signal?.throwIfAborted(); budget?.check("source-lifetime-admission");
      try { return new SourceLifetimeReader(indexPath); }
      catch(error) { if(!isBusy(error))throw error; }
      await new Promise<void>(resolve=>setTimeout(resolve,25));
    }
  }

  close(): void {
    if (this.closed) return;
    try { this.database.exec("ROLLBACK"); }
    finally { this.closed = true; this.database.close(); }
  }
}

/** Return false when a live capture or another WAL writer makes this attempt premature. */
export function collectUnusedSourceVersions(indexPath: string): boolean {
  const lifetime = new DatabaseSync(toNamespacedPath(sourceLifetimePath(indexPath)), { timeout: 0 });
  let index: DatabaseSync | undefined;
  try {
    const mode = lifetime.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    if (mode.journal_mode !== "delete") throw new Error("Source lifetime database must use rollback journal mode");
    lifetime.exec("BEGIN EXCLUSIVE");
    index = new DatabaseSync(toNamespacedPath(indexPath), { timeout: 0 });
    index.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    try {
      const tables=index.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('observation_records','observation_source_versions')").all() as {name:string}[];
      if(tables.length!==2) {
        index.exec("COMMIT");
        return false;
      }
      index.exec(`
        CREATE TEMP TABLE source_roots(id TEXT PRIMARY KEY) WITHOUT ROWID;
        INSERT OR IGNORE INTO source_roots(id)
          SELECT json_extract(value,'$.sourceVersionId') FROM observation_records
          WHERE kind='inventory' AND json_extract(value,'$._inventoryStorage')='versions/v2'
            AND json_type(value,'$.sourceVersionId')='text';
        DELETE FROM observation_source_capture_entries;
        DELETE FROM observation_source_captures;
        DELETE FROM observation_source_versions
        WHERE id NOT IN (SELECT id FROM source_roots);
      `);
      index.exec("COMMIT");
      removeAbandonedObservationTemporaryFiles(indexPath);
    } catch (error) {
      if (index.isTransaction) index.exec("ROLLBACK");
      throw error;
    }
    return true;
  } catch (error) {
    if (isBusy(error)) return false;
    throw error;
  } finally {
    index?.close();
    if (lifetime.isTransaction) lifetime.exec("ROLLBACK");
    lifetime.close();
  }
}
