import { setTimeout as delay } from "node:timers/promises";
import type { DatabaseSync } from "node:sqlite";

import type { ObservationBudget } from "@projector/core";

export interface SqliteWriteAdmissionOptions {
  readonly signal?: AbortSignal | undefined;
  readonly budget?: ObservationBudget | undefined;
  readonly scope?: string;
}

function isBusy(error: unknown): boolean {
  return error instanceof Error && "code" in error &&
    (error.code === "SQLITE_BUSY" || error.code === "ERR_SQLITE_ERROR") &&
    /database is locked|SQLITE_BUSY/u.test(error.message);
}

/** Wait only for SQLite's writer lock. The caller owns the transaction body and commit. */
export async function beginSqliteWrite(database: DatabaseSync, options: SqliteWriteAdmissionOptions = {}): Promise<void> {
  const scope = options.scope ?? ".";
  const check = (): void => {
    options.signal?.throwIfAborted();
    options.budget?.check("sqlite-writer-admission", scope);
  };
  const priorTimeout = (database.prepare("PRAGMA busy_timeout").get() as { timeout: number }).timeout;
  const startedAt = Date.now();
  let warnedAt = 0;
  for (;;) {
    check();
    if (database.isTransaction) throw new Error("SQLite write admission requires a connection outside a transaction");
    let beginError: unknown;
    // DatabaseSync is synchronous. Poll without its busy handler blocking the event loop,
    // then restore the connection's handler before returning control to the caller.
    database.exec("PRAGMA busy_timeout=0");
    try {
      database.exec("BEGIN IMMEDIATE");
    } catch (error) {
      beginError = error;
    } finally {
      database.exec(`PRAGMA busy_timeout=${priorTimeout}`);
    }
    if (beginError === undefined) return;
    if (!isBusy(beginError) || database.isTransaction) throw beginError;
    const now = Date.now();
    if (warnedAt === 0 || now - warnedAt >= 30_000) {
      console.warn(JSON.stringify({ event: "sqlite-writer-admission-wait", scope, waitedMs: now - startedAt }));
      warnedAt = now;
    }
    check();
    const remaining = options.budget?.remainingMs() ?? Infinity;
    try {
      await delay(Math.min(50, remaining), undefined, { signal: options.signal });
    } catch (error) {
      options.signal?.throwIfAborted();
      throw error;
    }
  }
}
