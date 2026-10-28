import { chownSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writePrivateFile(path: string, data: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, data, { mode: 0o600 });
  if (process.getuid?.() === 0) {
    const { uid, gid } = statSync(dir);
    chownSync(temporary, uid, gid);
  }
  renameSync(temporary, path);
}
