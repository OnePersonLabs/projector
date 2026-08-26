import { describe, expect, it } from "vitest";

import { RepositoryChangeLifecycleService } from "./service.js";

const repositoryRoot = process.env.PROJECTOR_INTERRUPTION_REPOSITORY;
const approvalSelector = process.env.PROJECTOR_INTERRUPTION_APPROVAL;
const enabled = repositoryRoot !== undefined && approvalSelector !== undefined;

describe.skipIf(!enabled)("lifecycle interruption worker", () => {
  it("applies until its parent deliberately terminates this process", async () => {
    const service = await RepositoryChangeLifecycleService.create(repositoryRoot!, { leaseStaleAfterMs: 300 });
    const result = await service.apply(approvalSelector!);
    expect(result.outcome).toBe("success");
  }, 40_000);
});
