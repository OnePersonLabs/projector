export type JsonRequest = Record<string, unknown>;
export type DispositionAction = 'retain' | 'remove' | 'replace' | 'revise';
export interface Contribution {
  path: string;
  decision: string;
  target?: string;
  action: DispositionAction;
  reason: string;
}
export interface Applicability {
  requirement: string;
  selectors: unknown[];
  reason: string;
  excluded?: boolean;
}
export interface Review {
  basis: string;
  reviewer: string;
  findings: string[];
  examined: string[];
  alternative: string;
}
export interface Plan {
  targetId: string;
  tasksHash: string;
  tasksText: string;
  taskChange?: { kind: 'scheduling' | 'authority-amended'; reason: string; targetId: string };
  applicability: Applicability[];
  contributions: Contribution[];
  prerequisites: string[];
  review?: Review;
}
export interface Evidence {
  id: string;
  basis: string;
  command: string;
  args: string[];
  scope: string[];
  passed: boolean;
  exitCode: number | null;
  output: string;
  outputHash: string;
  durationMs: number;
  runtime: string;
  recordedAt: string;
}
export interface Support {
  path: string;
  decision: string;
  basis?: string;
  target?: string;
}
export interface ChangeState {
  version: 1;
  root: string;
  change: string;
  baseline: string;
  candidateRoot: string;
  candidateBranch: string;
  candidateId: string;
  candidateHead: string;
  targetId: string;
  targetRef: string;
  previousTarget?: string;
  synchronizedTarget?: string;
  pendingSynchronization?: string;
  previousSupport: Support[];
  requirements: string[];
  inputHash: string;
  sourceTasksHash: string;
  candidateTasksAtSync: string;
  taskConflict?: string;
  bindingRenames?: Record<string, string>;
  phase: 'prepared' | 'implementing' | 'verified' | 'archived' | 'publishing' | 'published';
  plan?: Plan;
  evidence: Evidence[];
  archivePath?: string;
  publication?: string;
  implementationSeal?: string;
  candidateInputsHash?: string;
  verifiedTasksHash?: string;
  obligations: string[];
}
export interface ChangeServiceOptions {
  openspecEntry?: string;
  now?: () => number;
  beforeCandidateMutation?: (candidateRoot: string, operation: string) => Promise<void>;
  fault?: (point: 'after-target' | 'after-sync-file' | 'after-archive' | 'before-publication' | 'after-publication') => void | Promise<void>;
}
