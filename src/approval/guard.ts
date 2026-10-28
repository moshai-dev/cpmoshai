import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { writePrivateFile } from "../fsutil";
import { assertPrivateFile } from "../secrets";
import { verifyTotp } from "./totp";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

const stateSchema = z.object({
  secret: z.string().min(16),
  lastStep: z.number().int(),
  failures: z.number().int().min(0),
  lockedUntil: z.number().min(0),
});

type State = z.infer<typeof stateSchema>;

export type Verdict = "ok" | "invalid" | "locked";

export class TotpGuard {
  readonly #path: string;
  readonly #now: () => number;

  constructor(path: string, now: () => number = Date.now) {
    this.#path = path;
    this.#now = now;
  }

  enroll(secret: string, step: number): void {
    if (existsSync(this.#path)) throw new Error(`${this.#path} already exists`);
    this.#save({ secret, lastStep: step, failures: 0, lockedUntil: 0 });
  }

  verify(code: string): Verdict {
    const state = this.#load();
    const now = this.#now();
    if (state.lockedUntil > now) return "locked";
    const step = verifyTotp(state.secret, code, now, state.lastStep);
    if (step === null) {
      const failures = state.failures + 1;
      const locked = failures >= MAX_FAILURES;
      this.#save({ ...state, failures: locked ? 0 : failures, lockedUntil: locked ? now + LOCK_MS : 0 });
      return "invalid";
    }
    this.#save({ ...state, lastStep: step, failures: 0, lockedUntil: 0 });
    return "ok";
  }

  #load(): State {
    assertPrivateFile(this.#path, true);
    return stateSchema.parse(JSON.parse(readFileSync(this.#path, "utf8")));
  }

  #save(state: State): void {
    writePrivateFile(this.#path, JSON.stringify(state));
  }
}
