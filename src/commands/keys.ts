import { parseArgs } from "node:util";
import { loadRemoteConfig } from "../remote/config";
import { KeyStore, scopes, type Scope } from "../remote/keys";

const usage = `Usage:
  cpmoshai keys create <name> [--scope read|write|critical] [--expires-days N]
  cpmoshai keys list
  cpmoshai keys revoke <id>`;

function fail(message: string): never {
  throw new Error(`${message}\n\n${usage}`);
}

export function keys(args: string[]): void {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: { scope: { type: "string", default: "read" }, "expires-days": { type: "string" } },
  });
  const [command, argument] = positionals;
  const store = new KeyStore(loadRemoteConfig({ ...process.env, CPMOSHAI_ALLOWED_HOSTS: "-" }).keysFile);

  if (command === "create") {
    if (!argument) fail("A key name is required");
    if (!scopes.includes(values.scope as Scope)) fail(`Scope must be one of ${scopes.join(", ")}`);
    const days = values["expires-days"] === undefined ? undefined : Number(values["expires-days"]);
    if (days !== undefined && !(days > 0)) fail("--expires-days must be a positive number");
    const expiresAt = days === undefined ? undefined : new Date(Date.now() + days * 86_400_000);
    const { token, record } = store.create(argument, values.scope as Scope, expiresAt);
    console.log(`id:      ${record.id}\nscope:   ${record.scope}\nexpires: ${record.expiresAt ?? "never"}`);
    console.log(`\nToken (shown once, store it in your password manager):\n${token}`);
  } else if (command === "list") {
    for (const key of store.list()) {
      console.log(`${key.id}  ${key.scope.padEnd(8)}  ${key.expiresAt ?? "never"}  ${key.name}`);
    }
  } else if (command === "revoke") {
    if (!argument) fail("A key id is required");
    console.log(store.revoke(argument) ? `Revoked ${argument}` : `No key with id ${argument}`);
  } else {
    fail("Unknown keys command");
  }
}
