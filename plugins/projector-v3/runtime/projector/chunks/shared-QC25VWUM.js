import {
  ChangeLifecycleStore
} from "./shared-4VMBTM7P.js";
import {
  runObservationTask
} from "./shared-AIE6IGAJ.js";
import {
  RepositoryPathService,
  fileTransactionJournalRelativePath,
  parseFileTransactionJournalSource,
  withObservationScope
} from "./shared-QSFRBEBN.js";
import {
  canonicalJson,
  hashFramedDomain,
  observationLimitValue
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/cache-protection.js
import { constants } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import { basename } from "node:path";
var lifecycleRoot = ".projector/runtime/change-lifecycles";
var journalRoot = ".projector/runtime/journal";
var recordDirectories = ["captures", "approvals", "attempts", "results", "prepared", "states"];
var allowedDirectories = /* @__PURE__ */ new Set([
  lifecycleRoot,
  journalRoot,
  `${lifecycleRoot}/artifacts`,
  ...recordDirectories.map((directory) => `${lifecycleRoot}/${directory}`),
  `${lifecycleRoot}/artifacts/certificate`,
  `${lifecycleRoot}/artifacts/receipt`
]);
function checkBudget(budget) {
  if (budget.deadline !== null && Date.now() >= budget.deadline || budget.remainingEntries !== null && budget.remainingEntries < 0 || budget.remainingBytes !== null && budget.remainingBytes < 0) {
    throw new Error("Cache protection discovery bound exceeded; no complete protected-context proof is available. Reduce retained lifecycle metadata through its owner before retrying maintenance.");
  }
}
function isMissing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
async function discover(paths, budget, scope) {
  const sources = {};
  const visit = async (relativePath) => {
    scope.signal.throwIfAborted();
    checkBudget(budget);
    const resolved = await paths.resolveRead(relativePath);
    let status;
    try {
      status = await lstat(resolved.realTarget);
    } catch (error) {
      if (isMissing(error))
        return;
      throw error;
    }
    if (status.isSymbolicLink() || !status.isDirectory())
      throw new Error(`Cache protection metadata directory is unsafe: ${relativePath}`);
    const directory = await opendir(resolved.realTarget);
    for await (const entry of directory) {
      if (budget.remainingEntries !== null)
        budget.remainingEntries -= 1;
      checkBudget(budget);
      const child = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!allowedDirectories.has(child))
          throw new Error(`Unknown cache protection metadata directory: ${child}`);
        await visit(child);
        continue;
      }
      if (!entry.isFile() || !/^[0-9a-f]{64}\.json$/u.test(entry.name) || relativePath === lifecycleRoot || relativePath === `${lifecycleRoot}/artifacts`) {
        throw new Error(`Unknown or unsafe cache protection metadata entry: ${child}`);
      }
      const filePath = (await paths.resolveRead(child)).realTarget;
      const before = await lstat(filePath);
      if (!before.isFile() || before.isSymbolicLink())
        throw new Error(`Unsafe cache protection metadata file: ${child}`);
      if (budget.remainingBytes !== null)
        budget.remainingBytes -= before.size;
      checkBudget(budget);
      scope.budget.assertTotalBytes(before.size, child);
      const handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      let bytes;
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size) {
          throw new Error(`Cache protection metadata changed while opening: ${child}`);
        }
        bytes = Buffer.alloc(before.size + 1);
        let offset = 0;
        while (offset < bytes.length) {
          scope.signal.throwIfAborted();
          checkBudget(budget);
          const read = await handle.read(bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
          if (read.bytesRead === 0)
            break;
          scope.budget.consume("maxTotalBytes", read.bytesRead, "cache-protection-read", child);
          offset += read.bytesRead;
        }
        const after = await handle.stat();
        if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
          throw new Error(`Cache protection metadata changed while reading: ${child}`);
        }
        bytes = bytes.subarray(0, offset);
      } finally {
        await handle.close();
      }
      checkBudget(budget);
      sources[child] = bytes.toString("utf8");
    }
    checkBudget(budget);
  };
  await visit(lifecycleRoot);
  await visit(journalRoot);
  return sources;
}
function textField(value, field) {
  if (typeof value[field] !== "string" || value[field].length === 0)
    throw new Error(`Malformed cache protection metadata selector: ${field}`);
  return value[field];
}
async function readProtectedKnowledgeContextIds(repositoryRoot, requestedBudget, signal) {
  return withObservationScope({ ...signal === void 0 ? {} : { signal } }, async (scope) => {
    const budget = requestedBudget ?? { deadline: null, remainingEntries: null, remainingBytes: null };
    if (budget.deadline !== null && !Number.isSafeInteger(budget.deadline) || budget.remainingEntries !== null && !Number.isSafeInteger(budget.remainingEntries) || budget.remainingBytes !== null && !Number.isSafeInteger(budget.remainingBytes))
      throw new Error("Invalid cache protection discovery budget");
    const deadline = Math.min(observationLimitValue(budget.deadline), scope.deadline);
    budget.deadline = Number.isFinite(deadline) ? deadline : null;
    const remainingBytes = Math.min(observationLimitValue(budget.remainingBytes), observationLimitValue(scope.limits.maxDerivedBytes), scope.budget.remaining("maxTotalBytes"));
    budget.remainingBytes = Number.isFinite(remainingBytes) ? remainingBytes : null;
    const maxSourceBytes = budget.remainingBytes;
    checkBudget(budget);
    const paths = await RepositoryPathService.create(repositoryRoot);
    const sources = await discover(paths, budget, scope);
    const result = await runObservationTask("cache-protection", { repositoryRoot, sources, deadline: budget.deadline, maxSourceBytes }, { ...scope, deadline: observationLimitValue(budget.deadline), maxDerivedBytes: scope.limits.maxDerivedBytes });
    checkBudget(budget);
    return new Set(result);
  });
}
async function authenticateCacheProtectionSources(input) {
  const { repositoryRoot, sources } = input;
  if (input.deadline !== null && !Number.isSafeInteger(input.deadline))
    throw new Error("Invalid cache protection source deadline");
  const maxSourceBytes = input.maxSourceBytes ?? null;
  if (maxSourceBytes !== null && (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 0))
    throw new Error("Cache protection source allowance must be a nonnegative safe integer or null");
  const budget = { deadline: input.deadline, remainingEntries: null, remainingBytes: maxSourceBytes };
  const files = [];
  for (const [relativePath, source] of Object.entries(sources)) {
    const directory = relativePath.slice(0, relativePath.lastIndexOf("/"));
    if (!allowedDirectories.has(directory) || directory === lifecycleRoot || directory === `${lifecycleRoot}/artifacts` || !/^[0-9a-f]{64}\.json$/u.test(basename(relativePath)))
      throw new Error(`Unknown collected cache protection source: ${relativePath}`);
    if (budget.remainingEntries !== null)
      budget.remainingEntries -= 1;
    if (budget.remainingBytes !== null)
      budget.remainingBytes -= Buffer.byteLength(source);
    checkBudget(budget);
    const value = JSON.parse(source);
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new Error(`Malformed cache protection metadata: ${relativePath}`);
    files.push({ relativePath, value });
  }
  const store = ChangeLifecycleStore.fromCollectedSources(repositoryRoot, sources);
  const captures = /* @__PURE__ */ new Map();
  const approvals = /* @__PURE__ */ new Map();
  const attempts = /* @__PURE__ */ new Map();
  const results = /* @__PURE__ */ new Map();
  const transactions = /* @__PURE__ */ new Map();
  const authenticate = async (file, selector, read) => {
    checkBudget(budget);
    if (basename(file.relativePath) !== `${hashFramedDomain("change-lifecycle-selector", selector).slice("sha256:v1:".length)}.json`) {
      throw new Error(`Cache protection metadata filename does not authenticate its selector: ${file.relativePath}`);
    }
    const authenticated = await read();
    checkBudget(budget);
    if (canonicalJson(authenticated) !== canonicalJson(file.value))
      throw new Error(`Cache protection metadata changed during authentication: ${file.relativePath}`);
    return authenticated;
  };
  for (const kind of recordDirectories) {
    for (const file of files.filter(({ relativePath }) => relativePath.startsWith(`${lifecycleRoot}/${kind}/`))) {
      const selector = textField(file.value, kind === "captures" ? "semanticChangeId" : ["approvals", "attempts"].includes(kind) ? "id" : "attemptId");
      switch (kind) {
        case "captures":
          captures.set(selector, await authenticate(file, selector, () => store.readCapture(selector)));
          break;
        case "approvals":
          approvals.set(selector, await authenticate(file, selector, () => store.readApproval(selector)));
          break;
        case "attempts":
          attempts.set(selector, await authenticate(file, selector, () => store.readAttempt(selector)));
          break;
        case "results":
          results.set(selector, await authenticate(file, selector, () => store.readAttemptResult(selector)));
          break;
        case "prepared":
          await authenticate(file, selector, () => store.readPreparedSuccess(selector));
          break;
        case "states":
          await authenticate(file, selector, () => store.readAttemptState(selector));
          break;
      }
    }
  }
  for (const file of files) {
    checkBudget(budget);
    if (file.relativePath.startsWith(`${journalRoot}/`)) {
      const entry = file.value.entry;
      if (entry === null || typeof entry !== "object" || Array.isArray(entry))
        throw new Error(`Malformed journal metadata: ${file.relativePath}`);
      const selector = textField(entry, "transactionId");
      if (file.relativePath !== fileTransactionJournalRelativePath(selector))
        throw new Error(`Journal filename authentication failed: ${file.relativePath}`);
      const record = parseFileTransactionJournalSource(sources[file.relativePath], selector, repositoryRoot);
      checkBudget(budget);
      if (canonicalJson(record) !== canonicalJson(file.value))
        throw new Error(`Journal changed during cache protection discovery: ${selector}`);
      transactions.set(selector, record);
    } else if (file.relativePath.startsWith(`${lifecycleRoot}/artifacts/`)) {
      const domain = file.relativePath.startsWith(`${lifecycleRoot}/artifacts/certificate/`) ? "change-certificate-artifact" : "transaction-receipt-artifact";
      if (`${hashFramedDomain(domain, file.value).slice("sha256:v1:".length)}.json` !== basename(file.relativePath)) {
        throw new Error(`Lifecycle artifact authentication failed: ${file.relativePath}`);
      }
    }
  }
  const protectedIds = /* @__PURE__ */ new Set();
  const protect = (capture) => {
    if (capture.knowledgeContextId === void 0)
      return;
    if (!/^knowledge_context_[0-9a-f]{32}$/u.test(capture.knowledgeContextId))
      throw new Error(`Unknown protected knowledge context identity: ${capture.knowledgeContextId}`);
    protectedIds.add(capture.knowledgeContextId);
  };
  const attemptsByApproval = /* @__PURE__ */ new Map();
  for (const attempt of attempts.values()) {
    const approval = approvals.get(attempt.approvalId);
    if (approval === void 0 || approval.semanticChangeId !== attempt.semanticChangeId || approval.planHash !== attempt.planHash) {
      throw new Error(`Lifecycle attempt approval binding authentication failed: ${attempt.id}`);
    }
    const values = attemptsByApproval.get(approval.id) ?? [];
    values.push(attempt);
    attemptsByApproval.set(approval.id, values);
    const transaction = transactions.get(attempt.transactionId);
    const capture = captures.get(attempt.semanticChangeId);
    if (transaction !== void 0 && transaction.entry.planId !== capture?.planId)
      throw new Error(`Lifecycle attempt journal plan binding authentication failed: ${attempt.id}`);
  }
  for (const result of results.values()) {
    if (attempts.get(result.attemptId)?.approvalId !== result.approvalId)
      throw new Error(`Lifecycle result attempt binding authentication failed: ${result.attemptId}`);
  }
  for (const approval of approvals.values()) {
    checkBudget(budget);
    const capture = captures.get(approval.semanticChangeId);
    if (capture === void 0 || approval.planHash !== capture.planHash || approval.knowledgeContextId !== capture.knowledgeContextId) {
      throw new Error(`Lifecycle approval capture binding authentication failed: ${approval.id}`);
    }
    const ownedAttempts = attemptsByApproval.get(approval.id) ?? [];
    if (ownedAttempts.length === 0 || ownedAttempts.some((attempt) => {
      const result = results.get(attempt.id);
      const transaction = transactions.get(attempt.transactionId);
      return result === void 0 || transaction !== void 0 && !["committed", "rolled-back"].includes(transaction.entry.phase);
    }))
      protect(capture);
  }
  const capturesByPlan = /* @__PURE__ */ new Map();
  for (const capture of captures.values()) {
    const values = capturesByPlan.get(capture.planId) ?? [];
    values.push(capture);
    capturesByPlan.set(capture.planId, values);
  }
  for (const transaction of transactions.values()) {
    checkBudget(budget);
    if (["committed", "rolled-back"].includes(transaction.entry.phase))
      continue;
    const ownedCaptures = capturesByPlan.get(transaction.entry.planId);
    if (ownedCaptures === void 0)
      throw new Error(`Unknown nonterminal journal plan prevents complete cache protection: ${transaction.entry.transactionId}`);
    for (const capture of ownedCaptures)
      protect(capture);
  }
  checkBudget(budget);
  return [...protectedIds];
}

export {
  readProtectedKnowledgeContextIds,
  authenticateCacheProtectionSources
};
