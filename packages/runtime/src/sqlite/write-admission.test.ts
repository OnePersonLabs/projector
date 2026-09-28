import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ObservationBudget } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { beginSqliteWrite } from "./write-admission.js";

describe("beginSqliteWrite", () => {
  it("yields while another writer finishes, then begins exactly one transaction", async () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-sqlite-admission-"));
    const first = new DatabaseSync(join(directory, "index.sqlite"));
    const second = new DatabaseSync(join(directory, "index.sqlite"), { timeout: 5_000 });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      first.exec("CREATE TABLE facts(value INTEGER); BEGIN IMMEDIATE");
      const release = setTimeout(() => first.exec("COMMIT"), 100);
      try {
        await beginSqliteWrite(second, { scope: "fixture" });
      } finally {
        clearTimeout(release);
      }
      expect(second.isTransaction).toBe(true);
      expect((second.prepare("PRAGMA busy_timeout").get() as { timeout: number }).timeout).toBe(5_000);
      second.exec("INSERT INTO facts VALUES(1); COMMIT");
      expect((first.prepare("SELECT COUNT(*) AS count FROM facts").get() as { count: number }).count).toBe(1);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('"scope":"fixture"'));
    } finally {
      warning.mockRestore();
      if (first.isTransaction) first.exec("ROLLBACK");
      if (second.isTransaction) second.exec("ROLLBACK");
      second.close(); first.close(); rmSync(directory, { recursive: true, force: true });
    }
  });

  it("stops waiting on cancellation without opening a transaction", async () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-sqlite-admission-"));
    const first = new DatabaseSync(join(directory, "index.sqlite"));
    const second = new DatabaseSync(join(directory, "index.sqlite"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      first.exec("BEGIN IMMEDIATE");
      const controller = new AbortController();
      const cancel = setTimeout(() => controller.abort(new Error("cancelled lock wait")), 50);
      try {
        await expect(beginSqliteWrite(second, { signal: controller.signal })).rejects.toThrow(/cancelled lock wait/);
      } finally {
        clearTimeout(cancel);
      }
      expect(second.isTransaction).toBe(false);
    } finally {
      warning.mockRestore();
      first.exec("ROLLBACK"); second.close(); first.close(); rmSync(directory, { recursive: true, force: true });
    }
  });

  it("honors an explicit deadline and does not retry non-busy errors", async () => {
    const directory = mkdtempSync(join(tmpdir(), "projector-sqlite-admission-"));
    const first = new DatabaseSync(join(directory, "index.sqlite"));
    const second = new DatabaseSync(join(directory, "index.sqlite"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      first.exec("BEGIN IMMEDIATE");
      await expect(beginSqliteWrite(second, { budget: new ObservationBudget({ timeoutMs: 30 }) })).rejects.toThrow(/deadline/);
      expect(second.isTransaction).toBe(false);
      first.exec("ROLLBACK");
      second.close();
      await expect(beginSqliteWrite(second)).rejects.toThrow();
    } finally {
      warning.mockRestore();
      if (first.isTransaction) first.exec("ROLLBACK");
      if (second.isOpen) second.close(); first.close(); rmSync(directory, { recursive: true, force: true });
    }
  });
});
