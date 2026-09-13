import type { TestContext } from "vitest";
export function integrationTest(name: string, run: (context: TestContext) => void | Promise<void>): void;
