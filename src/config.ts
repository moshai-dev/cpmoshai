import { z } from "zod";
import { readSecretFile } from "./secrets";

const schema = z.object({
  CPANEL_HOST: z
    .string()
    .regex(/^[^/:\s]+$/, "hostname only, without scheme, port or path"),
  CPANEL_PORT: z.coerce.number().int().positive().default(2087),
  CPANEL_USER: z.string().min(1).default("root"),
  CPANEL_TOKEN: z.string().min(1).optional(),
  CPANEL_TOKEN_FILE: z.string().min(1).optional(),
  CPANEL_INSECURE_TLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CPANEL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export interface Config {
  host: string;
  port: number;
  user: string;
  token: string;
  insecureTls: boolean;
  timeoutMs: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const values = parsed.data;
  if (Boolean(values.CPANEL_TOKEN) === Boolean(values.CPANEL_TOKEN_FILE)) {
    throw new Error("Invalid configuration: set exactly one of CPANEL_TOKEN or CPANEL_TOKEN_FILE");
  }
  return {
    host: values.CPANEL_HOST,
    port: values.CPANEL_PORT,
    user: values.CPANEL_USER,
    token: values.CPANEL_TOKEN ?? readSecretFile(values.CPANEL_TOKEN_FILE!),
    insecureTls: values.CPANEL_INSECURE_TLS,
    timeoutMs: values.CPANEL_TIMEOUT_MS,
  };
}
