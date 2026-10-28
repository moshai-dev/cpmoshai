interface Entry {
  failures: number;
  windowStart: number;
  blockedUntil: number;
}

interface Options {
  maxFailures?: number;
  windowMs?: number;
  blockMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export class FailureLimiter {
  readonly #entries = new Map<string, Entry>();
  readonly #maxFailures: number;
  readonly #windowMs: number;
  readonly #blockMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;

  constructor(options: Options = {}) {
    this.#maxFailures = options.maxFailures ?? 5;
    this.#windowMs = options.windowMs ?? 15 * 60_000;
    this.#blockMs = options.blockMs ?? 15 * 60_000;
    this.#maxEntries = options.maxEntries ?? 10_000;
    this.#now = options.now ?? Date.now;
  }

  retryAfterSeconds(key: string): number {
    const blockedUntil = this.#entries.get(key)?.blockedUntil ?? 0;
    return Math.max(0, Math.ceil((blockedUntil - this.#now()) / 1000));
  }

  recordFailure(key: string): void {
    const now = this.#now();
    const previous = this.#entries.get(key);
    const entry =
      previous && now - previous.windowStart < this.#windowMs
        ? previous
        : { failures: 0, windowStart: now, blockedUntil: 0 };
    entry.failures += 1;
    if (entry.failures >= this.#maxFailures) entry.blockedUntil = now + this.#blockMs;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    if (this.#entries.size > this.#maxEntries) {
      this.#entries.delete(this.#entries.keys().next().value!);
    }
  }

  recordSuccess(key: string): void {
    this.#entries.delete(key);
  }
}
