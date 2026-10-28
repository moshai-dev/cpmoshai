import { existsSync, readFileSync } from "node:fs";

export function loadEnvFile(path: string, env: Record<string, string | undefined> = process.env): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    env[match[1]!] ??= match[2]!.replace(/^(["'])(.*)\1$/, "$2");
  }
}
