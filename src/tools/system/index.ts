import { z } from "zod";
import { run } from "../../system/exec";
import type { ToolDefinition } from "../types";

const units = [
  "httpd",
  "exim",
  "dovecot",
  "mariadb",
  "mysqld",
  "named",
  "pure-ftpd",
  "cpanel",
  "cphulkd",
  "sshd",
  "crond",
  "csf",
  "lfd",
] as const;

const unit = z.enum(units).describe("Service unit");
const priorities = ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"] as const;

const statusTool: ToolDefinition<{ unit: typeof unit }> = {
  name: "system_service_status",
  description: "Show systemd state, main PID, restart count and last start time of a service",
  mode: "read",
  input: { unit },
  run: async ({ unit }) => {
    const properties = ["ActiveState", "SubState", "Result", "MainPID", "NRestarts", "ActiveEnterTimestamp"];
    const output = await run([
      "systemctl",
      "show",
      `${unit}.service`,
      "--no-pager",
      ...properties.flatMap((property) => ["-p", property]),
    ]);
    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => line.split(/=(.*)/s).slice(0, 2)),
    );
  },
};

const logsTool: ToolDefinition<{
  unit: typeof unit;
  lines: z.ZodDefault<z.ZodNumber>;
  sinceMinutes: z.ZodOptional<z.ZodNumber>;
  priority: z.ZodOptional<z.ZodEnum<{ [K in (typeof priorities)[number]]: K }>>;
}> = {
  name: "system_service_logs",
  description: "Read the latest journal log lines of a service, newest last",
  mode: "read",
  input: {
    unit,
    lines: z.number().int().min(1).max(500).default(100),
    sinceMinutes: z.number().int().min(1).max(10_080).optional(),
    priority: z.enum(priorities).optional().describe("Show this severity and worse"),
  },
  run: async ({ unit, lines, sinceMinutes, priority }) =>
    run([
      "journalctl",
      "--no-pager",
      "-o",
      "short-iso",
      "-u",
      `${unit}.service`,
      "-n",
      String(lines),
      ...(sinceMinutes ? ["--since", `-${sinceMinutes}min`] : []),
      ...(priority ? ["-p", priority] : []),
    ]),
};

function command(
  name: string,
  description: string,
  argv: readonly string[],
): ToolDefinition<Record<string, never>> {
  return { name, description, mode: "read", input: {}, run: () => run(argv) };
}

const processesTool: ToolDefinition<{
  sort: z.ZodDefault<z.ZodEnum<{ cpu: "cpu"; mem: "mem" }>>;
  limit: z.ZodDefault<z.ZodNumber>;
}> = {
  name: "system_top_processes",
  description: "List the processes using the most CPU or memory",
  mode: "read",
  input: {
    sort: z.enum(["cpu", "mem"]).default("cpu"),
    limit: z.number().int().min(1).max(30).default(15),
  },
  run: async ({ sort, limit }) => {
    const output = await run([
      "ps",
      "-eo",
      "pid,user,pcpu,pmem,etime,comm",
      `--sort=-${sort === "cpu" ? "pcpu" : "pmem"}`,
    ]);
    return output.split("\n").slice(0, limit + 1).join("\n");
  },
};

export const systemTools: ToolDefinition[] = [
  statusTool,
  logsTool,
  processesTool,
  command("system_failed_units", "List systemd units in a failed state", [
    "systemctl",
    "--failed",
    "--no-pager",
    "--plain",
  ]),
  command("system_disk_usage", "Show disk usage per filesystem", [
    "df",
    "-hP",
    "-x",
    "tmpfs",
    "-x",
    "devtmpfs",
  ]),
  command("system_memory", "Show memory and swap usage in MB", ["free", "-m"]),
  command("system_uptime", "Show uptime and load average", ["uptime"]),
  command("system_listening_ports", "List listening TCP and UDP ports", ["ss", "-tuln"]),
];
