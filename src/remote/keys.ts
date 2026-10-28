import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { z } from "zod";
import { writePrivateFile } from "../fsutil";
import { assertPrivateFile } from "../secrets";
import type { Mode } from "../tools/types";

export const scopes = ["read", "write", "critical"] as const;
export type Scope = (typeof scopes)[number];

export const modesForScope: Record<Scope, readonly Mode[]> = {
  read: ["read"],
  write: ["read", "write"],
  critical: ["read", "write", "critical"],
};

const recordSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}$/),
  name: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  scope: z.enum(scopes),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().optional(),
});

const fileSchema = z.object({ keys: z.array(recordSchema) });

export type KeyRecord = z.infer<typeof recordSchema>;

export type Verification =
  | { record: KeyRecord }
  | { reason: "malformed" | "unknown" | "mismatch" | "expired" };

const TOKEN_PATTERN = /^cpm_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;
const NO_HASH = Buffer.alloc(32);

const digest = (secret: string): Buffer => createHash("sha256").update(secret).digest();

export class KeyStore {
  readonly #path: string;
  #cache?: { mtimeMs: number; keys: KeyRecord[] };

  constructor(path: string) {
    this.#path = path;
  }

  list(): KeyRecord[] {
    if (!existsSync(this.#path)) return [];
    const { mtimeMs } = statSync(this.#path);
    if (this.#cache?.mtimeMs === mtimeMs) return this.#cache.keys;
    assertPrivateFile(this.#path);
    const keys = fileSchema.parse(JSON.parse(readFileSync(this.#path, "utf8"))).keys;
    this.#cache = { mtimeMs, keys };
    return keys;
  }

  verify(token: string, now: Date = new Date()): Verification {
    const match = TOKEN_PATTERN.exec(token);
    const record = match && this.list().find((key) => key.id === match[1]);
    const stored = record ? Buffer.from(record.hash, "hex") : NO_HASH;
    const matches = timingSafeEqual(digest(match?.[2] ?? ""), stored);
    if (!match) return { reason: "malformed" };
    if (!record) return { reason: "unknown" };
    if (!matches) return { reason: "mismatch" };
    if (record.expiresAt && Date.parse(record.expiresAt) <= now.getTime()) {
      return { reason: "expired" };
    }
    return { record };
  }

  create(name: string, scope: Scope, expiresAt?: Date): { token: string; record: KeyRecord } {
    const id = randomBytes(4).toString("hex");
    const secret = randomBytes(32).toString("base64url");
    const record: KeyRecord = {
      id,
      name,
      hash: digest(secret).toString("hex"),
      scope,
      createdAt: new Date().toISOString(),
      ...(expiresAt && { expiresAt: expiresAt.toISOString() }),
    };
    this.#save([...this.list(), record]);
    return { token: `cpm_${id}_${secret}`, record };
  }

  revoke(id: string): boolean {
    const keys = this.list();
    if (!keys.some((key) => key.id === id)) return false;
    this.#save(keys.filter((key) => key.id !== id));
    return true;
  }

  #save(keys: KeyRecord[]): void {
    writePrivateFile(this.#path, `${JSON.stringify({ keys }, null, 2)}
`);
    this.#cache = undefined;
  }
}
