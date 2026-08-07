import type { TransactionPhase } from "@projector/core";

export const transactionCrashPhases = [
  "prepared",
  "workspace-mutating",
  "workspace-staged",
  "validating",
  "canonical-staging",
  "committing",
  "committed",
  "rolling-back",
  "rolled-back",
  "recovery-required",
] as const satisfies readonly TransactionPhase[];

export interface CrashInjectionSelection {
  phase: TransactionPhase;
  occurrence?: number;
}

export class CrashInjectedError extends Error {
  public readonly phase: TransactionPhase;
  public readonly occurrence: number;

  public constructor(phase: TransactionPhase, occurrence: number) {
    super(`Injected crash at transaction phase ${phase} (occurrence ${occurrence})`);
    this.name = "CrashInjectedError";
    this.phase = phase;
    this.occurrence = occurrence;
  }
}

export interface CrashInjector {
  checkpoint(phase: TransactionPhase): void;
  visited(): TransactionPhase[];
}

export function createCrashInjector(selection: CrashInjectionSelection): CrashInjector {
  const occurrence = selection.occurrence ?? 1;
  if (!Number.isSafeInteger(occurrence) || occurrence < 1) {
    throw new RangeError("Crash occurrence must be a positive safe integer");
  }
  const visits: TransactionPhase[] = [];
  let selectedVisits = 0;

  return {
    checkpoint(phase) {
      visits.push(phase);
      if (phase !== selection.phase) return;
      selectedVisits += 1;
      if (selectedVisits === occurrence) {
        throw new CrashInjectedError(phase, occurrence);
      }
    },
    visited() {
      return [...visits];
    },
  };
}

export function createNoopCrashInjector(): CrashInjector {
  const visits: TransactionPhase[] = [];
  return {
    checkpoint(phase) {
      visits.push(phase);
    },
    visited() {
      return [...visits];
    },
  };
}
