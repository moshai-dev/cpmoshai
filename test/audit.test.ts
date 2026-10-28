import { afterEach, expect, test } from "bun:test";
import { assessCpanel, assessCycle } from "../src/audit/assess";
import type { Cycles, Tiers } from "../src/audit/sources";
import { branchOf, compareVersions } from "../src/audit/version";
import { CpanelClient } from "../src/client";
import { auditTools, parseOsRelease } from "../src/tools/audit";

const NOW = Date.UTC(2026, 9, 28);

const php: Cycles = [
  { cycle: "8.5", eol: "2029-12-31", support: "2027-12-31", latest: "8.5.12" },
  { cycle: "8.3", eol: "2027-12-31", support: "2025-12-31", latest: "8.3.36" },
  { cycle: "8.2", eol: "2026-12-31", support: "2024-12-31", latest: "8.2.35" },
  { cycle: "8.1", eol: "2025-12-31", support: "2024-12-31", latest: "8.1.34" },
  { cycle: "7.4", eol: true, support: false, latest: "7.4.33" },
];

const assess = (installed: string, cycle = branchOf(installed)) =>
  assessCycle(php, { name: "PHP", installed, cycle, now: NOW, patchHint: "patch", upgradeHint: "upgrade" });

test("version helpers", () => {
  expect([compareVersions("8.3.9", "8.3.10"), compareVersions("8.3", "8.3.0"), compareVersions("9", "8.9")]).toEqual([-1, 0, 1]);
  expect(branchOf("11.126.0.30")).toBe("11.126");
});

test("end-of-life PHP is critical, whether dated or flagged", () => {
  expect(assess("8.1.34")).toMatchObject({ status: "end-of-life", severity: "critical" });
  expect(assess("7.4.33")).toMatchObject({ status: "end-of-life", severity: "critical" });
});

test("security-only PHP nearing its end is a warning, a distant end is info", () => {
  expect(assess("8.2.35")).toMatchObject({ status: "security-only", severity: "warning", patchAvailable: false });
  expect(assess("8.3.36")).toMatchObject({ status: "security-only", severity: "info" });
});

test("a missing patch release raises severity and names the fix", () => {
  const result = assess("8.5.3");
  expect(result).toMatchObject({ status: "supported", severity: "warning", patchAvailable: true, latest: "8.5.12" });
  expect(result.recommendation).toContain("patch");
  expect(assess("8.5.12")).toMatchObject({ severity: "ok", patchAvailable: false });
});

test("an unknown branch is reported, not guessed", () => {
  expect(assess("9.9.1")).toMatchObject({ status: "unknown", severity: "info" });
});

const tiers: Tiers = {
  "11.118": [{ build: "11.118.0.71", expires: 1761976861, is_lts: 1, is_main: 1 }],
  "11.126": [{ build: "11.126.0.78", expires: 1814313601, is_lts: 1, is_main: 1 }],
  "11.136": [{ build: "11.136.0.51", is_main: 1 }],
  "11.138": [{ build: "11.138.0.19", is_main: 1, named: ["stable", "current"] }],
};

test("cPanel versions are judged by tier and LTS expiry", () => {
  expect(assessCpanel(tiers, "11.118.0.60", NOW)).toMatchObject({ status: "end-of-life", severity: "critical" });
  expect(assessCpanel(tiers, "11.136.0.51", NOW)).toMatchObject({ status: "end-of-life", severity: "critical" });
  expect(assessCpanel(tiers, "11.126.0.30", NOW)).toMatchObject({ status: "supported", severity: "warning", latest: "11.126.0.78" });
  expect(assessCpanel(tiers, "11.138.0.19", NOW)).toMatchObject({ status: "supported", severity: "ok" });
  expect(assessCpanel(tiers, "10.0.0.1", NOW).status).toBe("unknown");
});

test("os-release parsing", () => {
  expect(parseOsRelease('NAME="AlmaLinux"\nID="almalinux"\nVERSION_ID="8.10"\nPRETTY_NAME="AlmaLinux 8.10"\n')).toMatchObject({
    ID: "almalinux",
    VERSION_ID: "8.10",
  });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("audit_server returns what it can and reports the checks that failed", async () => {
  globalThis.fetch = (async (url: string) => {
    if (url.includes("httpupdate.cpanel.net")) return Response.json({ tiers });
    if (url.includes("endoflife.date")) {
      return Response.json([{ cycle: "10.11", eol: "2028-02-16", support: "2026-02-16", latest: "10.11.14" }]);
    }
    const fn = new URL(url).pathname.split("/").pop();
    const data = fn === "version" ? { version: "11.126.0.30" } : { version: "10.11.8", server: "mariadb" };
    return Response.json({ metadata: { result: 1 }, data });
  }) as unknown as typeof fetch;

  const client = new CpanelClient({ host: "whm.test", port: 2087, user: "root", token: "t", insecureTls: false, timeoutMs: 1000 });
  const tool = auditTools.find((candidate) => candidate.name === "audit_server")!;
  const report = (await tool.run({}, client)) as {
    worst: string;
    findings: { name: string; severity: string }[];
    checksFailed: string[];
  };

  expect(report.findings.map((finding) => finding.name)).toEqual(expect.arrayContaining(["cPanel & WHM", "MariaDB"]));
  expect(report.checksFailed.some((failure) => failure.startsWith("php:"))).toBe(true);
  expect(report.worst).toBe("warning");
});
