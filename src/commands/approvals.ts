import { approve, type ApproveOutcome } from "../approval/approve";
import { TotpGuard } from "../approval/guard";
import { ApprovalStore } from "../approval/store";
import { CpanelClient } from "../client";
import { loadConfig } from "../config";
import { promptSecret } from "../prompt";
import { loadRemoteConfig } from "../remote/config";
import { remoteTools } from "../tools";

const SENSITIVE = /pass|secret|token|key|crt|cab|cert/i;

const redact = (args: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(args).map(([key, value]) => [key, SENSITIVE.test(key) ? "***" : value]));

const messages: Record<Exclude<ApproveOutcome, "approved">, string> = {
  "invalid-code": "Wrong code. Nothing was run.",
  locked: "Too many wrong codes. Approvals are locked for 15 minutes.",
  "not-pending": "No such pending approval (it may have expired or been decided).",
  "unknown-tool": "This approval names a tool that cannot be approved.",
  "invalid-arguments": "The stored arguments are invalid. Nothing was run.",
};

function remote() {
  return loadRemoteConfig({ ...process.env, CPMOSHAI_ALLOWED_HOSTS: "-" });
}

export function pending(): void {
  const store = new ApprovalStore(remote().approvalsDir);
  const open = store.listPending();
  if (open.length === 0) console.log("No pending approvals.");
  for (const action of open) {
    console.log(`${action.id}  ${action.tool}  key ${action.keyId}  expires ${action.expiresAt}`);
  }
}

export function deny(id: string): void {
  new ApprovalStore(remote().approvalsDir).decide(id, { status: "denied" });
  console.log(`Denied ${id}`);
}

export async function approveCommand(id: string): Promise<void> {
  const settings = remote();
  const store = new ApprovalStore(settings.approvalsDir);
  const action = store.get(id);
  if (!action || store.state(action) !== "pending") throw new Error(messages["not-pending"]);

  console.log(`Tool:    ${action.tool}\nKey:     ${action.keyId}\nExpires: ${action.expiresAt}`);
  console.log(`Args:    ${JSON.stringify(redact(action.args))}\n`);

  const code = await promptSecret("2FA code (Ctrl-C to cancel): ");
  const { outcome, action: decided } = await approve(
    { store, guard: new TotpGuard(settings.totpFile), client: new CpanelClient(loadConfig()), tools: remoteTools },
    id,
    code,
  );
  if (outcome !== "approved") throw new Error(messages[outcome]);

  console.log(decided?.error ? `Approved, but the call failed: ${decided.error}` : "Approved and executed.");
}
