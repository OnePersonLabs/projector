import type { CommandSpec } from "@projector/core";

const clone = <T>(value: T): T => structuredClone(value);

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandSandbox {
  run(command: CommandSpec): Promise<CommandResult>;
}

export class FakeCommandSandbox implements CommandSandbox {
  readonly #results: Readonly<Record<string, CommandResult>>;
  readonly #calls: CommandSpec[] = [];

  public constructor(results: Readonly<Record<string, CommandResult>> = {}) {
    this.#results = clone(results);
  }

  public async run(command: CommandSpec): Promise<CommandResult> {
    this.#calls.push(clone(command));
    const result = this.#results[command.id];
    if (result === undefined) throw new Error(`No fake command result configured for ${command.id}`);
    return clone(result);
  }

  public calls(): CommandSpec[] {
    return this.#calls.map(clone);
  }
}

export interface FakeHostCapabilities {
  scopedInstructions: boolean;
  lifecycleHooks: boolean;
  programmaticTasks: boolean;
  subagents: boolean;
  isolatedWorktrees: boolean;
  structuredResults: boolean;
  toolCallObservation: boolean;
  filesystemObservation: boolean;
  shellObservation: boolean;
  cancellation: boolean;
  stateBoundCapabilities: boolean;
}

export type FakeHostEvent =
  | { type: "tool-call"; name: string }
  | { type: "filesystem-write"; path: string }
  | { type: "shell-command"; argv: string[] }
  | { type: "cancelled" };

export interface FakeHostRequest {
  argv: string[];
  cwd: string;
  instructions: string;
  environment: Record<string, string>;
}

export interface FakeHostResult extends CommandResult {
  events: FakeHostEvent[];
  structuredResult?: Record<string, unknown>;
}

export class FakeHostProcess {
  public readonly capabilities: FakeHostCapabilities;
  readonly #results: FakeHostResult[];
  readonly #sessions: FakeHostRequest[] = [];

  public constructor(
    results: readonly FakeHostResult[] = [],
    capabilities: Partial<FakeHostCapabilities> = {},
  ) {
    this.#results = results.map(clone);
    this.capabilities = {
      scopedInstructions: true,
      lifecycleHooks: true,
      programmaticTasks: true,
      subagents: false,
      isolatedWorktrees: true,
      structuredResults: true,
      toolCallObservation: true,
      filesystemObservation: true,
      shellObservation: true,
      cancellation: true,
      stateBoundCapabilities: true,
      ...capabilities,
    };
  }

  public async run(request: FakeHostRequest): Promise<FakeHostResult> {
    this.#sessions.push(clone(request));
    const result = this.#results.shift();
    if (result === undefined) throw new Error("Fake host result queue is empty");
    return clone(result);
  }

  public sessions(): FakeHostRequest[] {
    return this.#sessions.map(clone);
  }
}
