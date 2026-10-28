import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { writePrivateFile } from "../fsutil";

const ID_PATTERN = /^[0-9a-f]{12}$/;

const actionSchema = z.object({
  id: z.string().regex(ID_PATTERN),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  keyId: z.string().min(1),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: z.enum(["pending", "approved", "denied"]),
  decidedAt: z.iso.datetime().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export type PendingAction = z.infer<typeof actionSchema>;
export type ActionState = PendingAction["status"] | "expired";

interface Options {
  ttlMs?: number;
  maxPendingPerKey?: number;
  now?: () => number;
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

export class ApprovalStore {
  readonly #dir: string;
  readonly #ttlMs: number;
  readonly #maxPending: number;
  readonly #now: () => number;

  constructor(dir: string, options: Options = {}) {
    this.#dir = dir;
    this.#ttlMs = options.ttlMs ?? 5 * 60_000;
    this.#maxPending = options.maxPendingPerKey ?? 10;
    this.#now = options.now ?? Date.now;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  state(action: PendingAction): ActionState {
    return action.status === "pending" && Date.parse(action.expiresAt) <= this.#now()
      ? "expired"
      : action.status;
  }

  get(id: string): PendingAction | null {
    const path = this.#path(id);
    if (!ID_PATTERN.test(id) || !existsSync(path)) return null;
    return actionSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  }

  listPending(): PendingAction[] {
    return readdirSync(this.#dir)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => this.get(file.slice(0, -5)) ?? [])
      .filter((action) => this.state(action) === "pending");
  }

  create(tool: string, args: Record<string, unknown>, keyId: string): PendingAction {
    this.sweep();
    const open = this.listPending().filter((action) => action.keyId === keyId);
    const duplicate = open.find(
      (action) => action.tool === tool && canonical(action.args) === canonical(args),
    );
    if (duplicate) return duplicate;
    if (open.length >= this.#maxPending) {
      throw new Error("Too many pending approvals; wait for them to be decided or to expire");
    }
    const now = this.#now();
    const action: PendingAction = {
      id: randomBytes(6).toString("hex"),
      tool,
      args,
      keyId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.#ttlMs).toISOString(),
      status: "pending",
    };
    this.#write(action);
    return action;
  }

  decide(
    id: string,
    outcome: { status: "approved" | "denied"; result?: unknown; error?: string },
  ): PendingAction {
    const action = this.get(id);
    if (!action || this.state(action) !== "pending") throw new Error(`No pending approval ${id}`);
    const decided = { ...action, ...outcome, decidedAt: new Date(this.#now()).toISOString() };
    this.#write(decided);
    return decided;
  }

  sweep(maxAgeMs = 24 * 3_600_000): void {
    for (const file of readdirSync(this.#dir)) {
      const path = join(this.#dir, file);
      if (this.#now() - statSync(path).mtimeMs > maxAgeMs) rmSync(path, { force: true });
    }
  }

  #path(id: string): string {
    return join(this.#dir, `${id}.json`);
  }

  #write(action: PendingAction): void {
    writePrivateFile(this.#path(action.id), JSON.stringify(action));
  }
}
