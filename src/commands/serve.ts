import { ApprovalStore } from "../approval/store";
import { CpanelClient } from "../client";
import { loadConfig } from "../config";
import { stderrAudit } from "../remote/audit";
import { loadRemoteConfig } from "../remote/config";
import { createHandler } from "../remote/handler";
import { KeyStore } from "../remote/keys";
import { FailureLimiter } from "../remote/limiter";
import { createIpAllowlist } from "../remote/network";
import { remoteTools } from "../tools";

export function serve(): void {
  if (!process.env.CPANEL_TOKEN_FILE) {
    throw new Error("Remote mode requires CPANEL_TOKEN_FILE; CPANEL_TOKEN is not accepted");
  }
  const config = loadConfig();
  const remote = loadRemoteConfig();

  const server = Bun.serve({
    unix: remote.socket,
    maxRequestBodySize: 1_048_576,
    fetch: createHandler({
      client: new CpanelClient(config),
      keys: new KeyStore(remote.keysFile),
      approvals: new ApprovalStore(remote.approvalsDir),
      tools: remoteTools,
      limiter: new FailureLimiter(),
      allowedHosts: new Set(remote.allowedHosts),
      allowedOrigins: new Set(remote.allowedOrigins),
      isIpAllowed: createIpAllowlist(remote.allowedIps),
      audit: stderrAudit,
    }),
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void server.stop().then(() => process.exit(0));
    });
  }
  console.error(`cpmoshai listening on ${remote.socket}`);
}
