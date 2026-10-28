import { branchOf, compareVersions } from "./version";
import type { Cycles, Tiers } from "./sources";

export type Status = "supported" | "security-only" | "end-of-life" | "unknown";
export type Severity = "ok" | "info" | "warning" | "critical";

export interface Assessment {
  name: string;
  installed: string;
  status: Status;
  severity: Severity;
  supportEnds: string | null;
  endOfLife: string | null;
  latest: string | null;
  patchAvailable: boolean;
  recommendation: string;
  usedBy?: string[];
}

const DAY = 86_400_000;
const SOON_DAYS = 180;
const RANK: Record<Severity, number> = { ok: 0, info: 1, warning: 2, critical: 3 };
const LIVE_TIERS = ["stable", "release", "current", "edge"];

export const worst = (a: Severity, b: Severity): Severity => (RANK[a] >= RANK[b] ? a : b);

const passed = (value: string | boolean | undefined, now: number): boolean =>
  typeof value === "string" && Date.parse(value) <= now;

const dateOnly = (value: string | boolean | undefined): string | null =>
  typeof value === "string" ? value : null;

interface CycleOptions {
  name: string;
  installed: string;
  cycle: string;
  now: number;
  patchHint: string;
  upgradeHint: string;
}

export function assessCycle(cycles: Cycles, options: CycleOptions): Assessment {
  const { name, installed, cycle, now, patchHint, upgradeHint } = options;
  const entry = cycles.find((candidate) => candidate.cycle === cycle);
  if (!entry) {
    return {
      name, installed, status: "unknown", severity: "info", supportEnds: null, endOfLife: null,
      latest: null, patchAvailable: false,
      recommendation: `No lifecycle data found for ${name} ${cycle}.`,
    };
  }

  const endOfLife = entry.eol === true || passed(entry.eol, now);
  const supportOver = entry.support === false || passed(entry.support, now);
  const status: Status = endOfLife ? "end-of-life" : supportOver ? "security-only" : "supported";
  const patchAvailable =
    installed.split(".").length > cycle.split(".").length && compareVersions(installed, entry.latest) < 0;
  const eolDate = dateOnly(entry.eol);
  const eolSoon = eolDate !== null && Date.parse(eolDate) - now < SOON_DAYS * DAY;

  let severity: Severity = status === "end-of-life" ? "critical" : status === "security-only" ? "info" : "ok";
  if (status === "security-only" && eolSoon) severity = "warning";
  if (patchAvailable) severity = worst(severity, "warning");

  const advice: string[] = [];
  if (status === "end-of-life") advice.push(`${name} ${cycle} no longer receives security fixes. ${upgradeHint}`);
  else if (status === "security-only") {
    advice.push(`${name} ${cycle} gets security fixes only until ${eolDate ?? "an unannounced date"}. Plan an upgrade.`);
  }
  if (patchAvailable) advice.push(`${installed} is behind ${entry.latest}. ${patchHint}`);
  if (advice.length === 0) advice.push("Up to date and supported.");

  return {
    name, installed, status, severity,
    supportEnds: dateOnly(entry.support),
    endOfLife: eolDate,
    latest: entry.latest,
    patchAvailable,
    recommendation: advice.join(" "),
  };
}

export function assessCpanel(tiers: Tiers, installed: string, now: number): Assessment {
  const name = "cPanel & WHM";
  const entries = tiers[branchOf(installed)];
  const entry = entries?.find((candidate) => candidate.is_main) ?? entries?.[0];
  if (!entry) {
    return {
      name, installed, status: "unknown", severity: "info", supportEnds: null, endOfLife: null,
      latest: null, patchAvailable: false,
      recommendation: `${installed} is not a version cPanel lists on its update tiers.`,
    };
  }

  const expiresAt = entry.expires ? entry.expires * 1000 : null;
  const onLiveTier = entry.named?.some((tier) => LIVE_TIERS.includes(tier)) ?? false;
  const inLtsWindow = Boolean(entry.is_lts) && (expiresAt === null || expiresAt > now);
  const supported = onLiveTier || inLtsWindow;
  const patchAvailable = compareVersions(installed, entry.build) < 0;
  const endOfLife = expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : null;

  const severity: Severity = !supported ? "critical" : patchAvailable ? "warning" : "ok";
  const advice: string[] = [];
  if (!supported) {
    advice.push("This release is no longer on a supported cPanel tier. Set the update tier to STABLE or LTS in WHM > Update Preferences, then run /scripts/upcp.");
  }
  if (patchAvailable) advice.push(`${installed} is behind ${entry.build}. Run /scripts/upcp to update.`);
  if (advice.length === 0) advice.push("Up to date and supported.");

  return {
    name, installed, status: supported ? "supported" : "end-of-life", severity,
    supportEnds: endOfLife, endOfLife, latest: entry.build, patchAvailable,
    recommendation: advice.join(" "),
  };
}
