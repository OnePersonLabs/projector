export interface ClockAdvance {
  milliseconds?: number;
  seconds?: number;
  minutes?: number;
  hours?: number;
}

export class DeterministicClock {
  readonly #initialMilliseconds: number;
  #currentMilliseconds: number;

  public constructor(initialTime = "2000-01-01T00:00:00.000Z") {
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(initialTime)) {
      throw new TypeError(`Deterministic clock time must include an explicit timezone: ${initialTime}`);
    }
    const milliseconds = Date.parse(initialTime);
    if (!Number.isFinite(milliseconds)) {
      throw new TypeError(`Invalid deterministic clock time: ${initialTime}`);
    }
    this.#initialMilliseconds = milliseconds;
    this.#currentMilliseconds = milliseconds;
  }

  public now(): string {
    return new Date(this.#currentMilliseconds).toISOString();
  }

  public date(): Date {
    return new Date(this.#currentMilliseconds);
  }

  public advance(duration: ClockAdvance): string {
    const increment =
      (duration.milliseconds ?? 0) +
      (duration.seconds ?? 0) * 1_000 +
      (duration.minutes ?? 0) * 60_000 +
      (duration.hours ?? 0) * 3_600_000;
    if (!Number.isFinite(increment) || increment < 0) {
      throw new RangeError("Clock advance must be a finite non-negative duration");
    }
    this.#currentMilliseconds += increment;
    return this.now();
  }

  public reset(): string {
    this.#currentMilliseconds = this.#initialMilliseconds;
    return this.now();
  }
}

export class DeterministicIdProvider {
  readonly #prefix: string;
  #nextValue: number | undefined;

  public constructor(prefix = "test", start = 1) {
    assertIdPart(prefix, "prefix");
    if (!Number.isSafeInteger(start) || start < 0) {
      throw new RangeError("ID sequence start must be a non-negative safe integer");
    }
    this.#prefix = prefix;
    this.#nextValue = start;
  }

  public next(label = "id"): string {
    assertIdPart(label, "label");
    const nextValue = this.#nextValue;
    if (nextValue === undefined) {
      throw new RangeError("Deterministic ID sequence is exhausted");
    }
    const id = `${this.#prefix}_${label}_${String(nextValue).padStart(4, "0")}`;
    this.#nextValue = nextValue === Number.MAX_SAFE_INTEGER ? undefined : nextValue + 1;
    return id;
  }
}

function assertIdPart(value: string, kind: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError(`ID ${kind} must contain only letters, digits, underscores, or hyphens`);
  }
}
