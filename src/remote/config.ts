import { z } from "zod";

export const DEFAULT_KEYS_FILE = "/var/lib/cpmoshai/keys.json";

const list = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const schema = z.object({
  CPMOSHAI_SOCKET: z.string().min(1).default("/run/cpmoshai/mcp.sock"),
  CPMOSHAI_KEYS_FILE: z.string().min(1).default(DEFAULT_KEYS_FILE),
  CPMOSHAI_STATE_DIR: z.string().min(1).default("/var/lib/cpmoshai"),
  CPMOSHAI_TOTP_FILE: z.string().min(1).default("/etc/cpmoshai/totp.json"),
  CPMOSHAI_ALLOWED_HOSTS: list.pipe(z.array(z.string()).min(1, "list the public Host header values")),
  CPMOSHAI_ALLOWED_ORIGINS: list,
  CPMOSHAI_ALLOWED_IPS: list,
});

export interface RemoteConfig {
  socket: string;
  keysFile: string;
  approvalsDir: string;
  totpFile: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  allowedIps: string[];
}

export function loadRemoteConfig(env: Record<string, string | undefined> = process.env): RemoteConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const values = parsed.data;
  return {
    socket: values.CPMOSHAI_SOCKET,
    keysFile: values.CPMOSHAI_KEYS_FILE,
    approvalsDir: `${values.CPMOSHAI_STATE_DIR}/approvals`,
    totpFile: values.CPMOSHAI_TOTP_FILE,
    allowedHosts: values.CPMOSHAI_ALLOWED_HOSTS.map((host) => host.toLowerCase()),
    allowedOrigins: values.CPMOSHAI_ALLOWED_ORIGINS,
    allowedIps: values.CPMOSHAI_ALLOWED_IPS,
  };
}
