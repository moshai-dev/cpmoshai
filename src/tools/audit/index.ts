import { readdirSync, readFileSync } from "node:fs";
import { z } from "zod";
import { assessCpanel, assessCycle, worst, type Assessment, type Severity } from "../../audit/assess";
import { cpanelTiers, lifecycleCycles } from "../../audit/sources";
import { branchOf } from "../../audit/version";
import type { CpanelClient } from "../../client";
import { run } from "../../system/exec";
import type { ToolDefinition } from "../types";

const EA_ROOT = "/opt/cpanel";

const vhostSchema = z.object({
  versions: z.array(z.object({ version: z.string(), vhost: z.string() })),
});
const mysqlSchema = z.object({ version: z.string(), server: z.string().optional() });
const versionSchema = z.object({ version: z.string() });

const OS_PRODUCTS: Record<string, { product: string; cycle: (version: string) => string }> = {
  almalinux: { product: "almalinux", cycle: (v) => branchOf(v, 1) },
  rocky: { product: "rocky-linux", cycle: (v) => branchOf(v, 1) },
  centos: { product: "centos", cycle: (v) => branchOf(v, 1) },
  rhel: { product: "rhel", cycle: (v) => branchOf(v, 1) },
  cloudlinux: { product: "rhel", cycle: (v) => branchOf(v, 1) },
  ubuntu: { product: "ubuntu", cycle: (v) => v },
};

export function parseOsRelease(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => /^([A-Z_]+)=("?)(.*)\2$/.exec(line))
      .flatMap((match) => (match ? [[match[1]!, match[3]!] as const] : [])),
  );
}

async function installedPhp(): Promise<{ package: string; version: string }[]> {
  const packages = readdirSync(EA_ROOT).filter((entry) => /^ea-php\d+$/.test(entry)).sort();
  return Promise.all(
    packages.map(async (name) => ({
      package: name,
      version: (await run([`${EA_ROOT}/${name}/root/usr/bin/php`, "-r", "echo PHP_VERSION;"])).trim(),
    })),
  );
}

async function auditPhp(client: CpanelClient, now: number): Promise<Assessment[]> {
  const [installed, cycles, vhosts] = await Promise.all([
    installedPhp(),
    lifecycleCycles("php"),
    client.whm("php_get_vhost_versions").then((data) => vhostSchema.safeParse(data)),
  ]);
  return installed.map(({ package: name, version }) => ({
    ...assessCycle(cycles, {
      name: `PHP (${name})`,
      installed: version,
      cycle: branchOf(version),
      now,
      patchHint: `Update with: dnf update '${name}*' (or /scripts/upcp).`,
      upgradeHint: "Move its sites to a supported version with whm_php_set_vhost_version, then remove this one.",
    }),
    usedBy: vhosts.success
      ? vhosts.data.versions.filter((entry) => entry.version === name).map((entry) => entry.vhost)
      : undefined,
  }));
}

async function auditCpanel(client: CpanelClient, now: number): Promise<Assessment[]> {
  const { version } = versionSchema.parse(await client.whm("version"));
  return [assessCpanel(await cpanelTiers(), version, now)];
}

async function auditOs(_client: CpanelClient, now: number): Promise<Assessment[]> {
  const release = parseOsRelease(readFileSync("/etc/os-release", "utf8"));
  const product = OS_PRODUCTS[release.ID ?? ""];
  if (!product || !release.VERSION_ID) throw new Error(`Unsupported operating system: ${release.ID ?? "unknown"}`);
  return [
    assessCycle(await lifecycleCycles(product.product), {
      name: release.PRETTY_NAME ?? release.ID!,
      installed: release.VERSION_ID,
      cycle: product.cycle(release.VERSION_ID),
      now,
      patchHint: "Run dnf update (or /scripts/upcp) in a maintenance window.",
      upgradeHint: "Plan an OS upgrade or migration.",
    }),
  ];
}

async function auditDatabase(client: CpanelClient, now: number): Promise<Assessment[]> {
  const { version, server } = mysqlSchema.parse(await client.whm("current_mysql_version"));
  const product = server?.toLowerCase().includes("maria") ? "mariadb" : "mysql";
  return [
    assessCycle(await lifecycleCycles(product), {
      name: product === "mariadb" ? "MariaDB" : "MySQL",
      installed: version,
      cycle: branchOf(version),
      now,
      patchHint: "Update with dnf update, or upgrade it in WHM > MySQL/MariaDB Upgrade.",
      upgradeHint: "Upgrade in WHM > MySQL/MariaDB Upgrade after taking a backup.",
    }),
  ];
}

type Audit = (client: CpanelClient, now: number) => Promise<Assessment[]>;

const NOTE =
  "End-of-life software gets no security fixes and should be treated as vulnerable. " +
  "Being behind the latest release may mean missed fixes. This is a lifecycle check, not a CVE scan.";

function auditTool(name: string, description: string, audit: Audit): ToolDefinition<Record<string, never>> {
  return {
    name,
    description: `${description} ${NOTE}`,
    mode: "read",
    input: {},
    run: async (_args, client) => ({ note: NOTE, results: await audit(client, Date.now()) }),
  };
}

const summaryTool: ToolDefinition<Record<string, never>> = {
  name: "audit_server",
  description:
    "Check PHP, cPanel & WHM, the operating system and the database for end-of-life and available updates, worst first",
  mode: "read",
  input: {},
  run: async (_args, client) => {
    const now = Date.now();
    const checks = { php: auditPhp, cpanel: auditCpanel, os: auditOs, database: auditDatabase };
    const settled = await Promise.allSettled(Object.values(checks).map((check) => check(client, now)));
    const findings = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const failed = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${Object.keys(checks)[index]}: ${result.reason instanceof Error ? result.reason.message : result.reason}`]
        : [],
    );
    const order: Severity[] = ["critical", "warning", "info", "ok"];
    findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    return {
      note: NOTE,
      worst: findings.reduce<Severity>((level, finding) => worst(level, finding.severity), "ok"),
      findings,
      checksFailed: failed,
    };
  },
};

export const auditTools: ToolDefinition[] = [
  summaryTool,
  auditTool("audit_php", "List every installed PHP version with its support status, the sites using it, and whether to upgrade.", auditPhp),
  auditTool("audit_cpanel", "Check the installed cPanel & WHM version against cPanel's release tiers.", auditCpanel),
  auditTool("audit_os", "Check the server operating system against its vendor support dates.", auditOs),
  auditTool("audit_database", "Check the MySQL or MariaDB version against its support dates.", auditDatabase),
];
