import { describe, expect, it } from "vitest";

import { authorityRecord } from "../governance/test-fixtures.js";
import { createRepositoryScriptLens } from "../governance/index.js";
import { AUTHORITY_ORDER, assessLensAuthority, compareAuthority } from "./index.js";

describe("authority ordering and activation", () => {
  it("implements the normative total authority order", () => {
    const reordered = [...AUTHORITY_ORDER].reverse().sort(compareAuthority);
    expect(reordered).toEqual(AUTHORITY_ORDER);
  });

  it("does not activate a lens from a provisional or missing record", () => {
    const approved = authorityRecord("authority:repository-script");
    const lens = createRepositoryScriptLens({
      status: "active",
      authorityRecordId: approved.id,
      governanceBasis: [{ kind: "architecture-decision", decisionId: "decision:repository-layout" }],
    });

    expect(assessLensAuthority(lens, []).eligible).toBe(false);
    expect(assessLensAuthority(lens, [{ ...approved, status: "provisional" }]).eligible).toBe(false);
    expect(assessLensAuthority(lens, [approved]).eligible).toBe(true);
  });
});
