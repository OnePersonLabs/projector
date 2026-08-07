import { readHookState } from "./lib/hook-state.mjs";
import { validateToolRequest } from "./lib/validate-repo.mjs";

export async function onPreTool(request) {
  const state = await readHookState();
  return validateToolRequest(request, state);
}
