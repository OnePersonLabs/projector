export function validateToolRequest(request, state) {
  if (request.kind === "write" && !state.allowWrites) {
    return { allowed: false, reason: "repository writes are disabled" };
  }
  return { allowed: true };
}
