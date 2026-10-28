import { readFileSync, statSync } from "node:fs";

export function assertPrivateFile(path: string, requireOwner = false): void {
  const stats = statSync(path);
  if (stats.mode & 0o077) {
    throw new Error(`${path} must not be accessible by group or others (chmod 600)`);
  }
  if (requireOwner && stats.uid !== process.getuid?.()) {
    throw new Error(`${path} must be owned by the user running this command`);
  }
}

export function readSecretFile(path: string): string {
  assertPrivateFile(path);
  const secret = readFileSync(path, "utf8").trim();
  if (!secret) throw new Error(`${path} is empty`);
  return secret;
}
