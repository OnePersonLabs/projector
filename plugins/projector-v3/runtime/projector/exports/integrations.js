import {
  FakeSurfaceAdapter,
  FileExternalOperationJournal,
  FileSurfaceSnapshotStore,
  InMemoryExternalOperationJournal,
  captureAndPersistSurfaceSnapshot,
  captureSurfaceSnapshot,
  executeSurfacePlan,
  rebuildPinnedSurfaceSnapshot
} from "../chunks/shared-TJR6XE2K.js";
import {
  InferenceFailure,
  runStructuredInference
} from "../chunks/shared-2TZMVSH7.js";
import {
  CodexExecProviderError,
  DISABLED_CODEX_EXEC_FEATURES,
  SpawnCodexProcessRunner,
  authenticateRepresentationBinding,
  createCodexExecProvider,
  createCodexExecRouter,
  createCodexHostAdapter,
  createHostAdapter,
  createHostSessionRecord,
  hostSessionSelector,
  loadAuthenticatedRepositorySession
} from "../chunks/shared-J5UNDGIN.js";
import "../chunks/shared-XN3IZTFL.js";
import "../chunks/shared-53BCDAHA.js";
import "../chunks/shared-JRUJSZFM.js";
import "../chunks/shared-EK2KJXX2.js";
import "../chunks/shared-RMBXVF7C.js";
import "../chunks/shared-Q56AARV7.js";
import "../chunks/shared-WC2OT3WX.js";

// node_modules/@projector/integrations/dist/claude/adapter.js
function createClaudeHostAdapter(dependencies) {
  return createHostAdapter("claude", "claude", dependencies);
}
export {
  CodexExecProviderError,
  DISABLED_CODEX_EXEC_FEATURES,
  FakeSurfaceAdapter,
  FileExternalOperationJournal,
  FileSurfaceSnapshotStore,
  InMemoryExternalOperationJournal,
  InferenceFailure,
  SpawnCodexProcessRunner,
  authenticateRepresentationBinding,
  captureAndPersistSurfaceSnapshot,
  captureSurfaceSnapshot,
  createClaudeHostAdapter,
  createCodexExecProvider,
  createCodexExecRouter,
  createCodexHostAdapter,
  createHostAdapter,
  createHostSessionRecord,
  executeSurfacePlan,
  hostSessionSelector,
  loadAuthenticatedRepositorySession,
  rebuildPinnedSurfaceSnapshot,
  runStructuredInference
};
