import { z } from "zod";

const schema = z.object({
  CPANEL_HOST: z
    .string()
    .regex(/^[^/:\s]+$/, "hostname only, without scheme, port or path"),
  CPANEL_PORT: z.coerce.number().int().positive().default(2087),
  CPANEL_USER: z.string().min(1).default("root"),
  CPANEL_TOKEN: z.string().min(1),
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
  return {
    host: values.CPANEL_HOST,
    port: values.CPANEL_PORT,
    user: values.CPANEL_USER,
    token: values.CPANEL_TOKEN,
    insecureTls: values.CPANEL_INSECURE_TLS,
    timeoutMs: values.CPANEL_TIMEOUT_MS,
  };
}
