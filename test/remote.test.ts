import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CpanelClient } from "../src/client";
import type { AuditEvent } from "../src/remote/audit";
import { ApprovalStore } from "../src/approval/store";
import { createHandler } from "../src/remote/handler";
import { KeyStore } from "../src/remote/keys";
import { FailureLimiter } from "../src/remote/limiter";
import { clientIp, createIpAllowlist } from "../src/remote/network";
import { remoteTools } from "../src/tools";

const HOST = "mcp.example.com";
const realFetch = globalThis.fetch;
let dir: string;
let keys: KeyStore;
let events: AuditEvent[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cpmoshai-"));
  keys = new KeyStore(join(dir, "keys.json"));
  events = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rmSync(dir, { recursive: true, force: true });
});

function handler(overrides: { allowedIps?: string[]; limiter?: FailureLimiter } = {}) {
  const client = new CpanelClient({
    host: "whm.test",
    port: 2087,
    user: "root",
    token: "whm-secret",
    insecureTls: false,
    timeoutMs: 1000,
  });
  return createHandler({
    client,
    keys,
    approvals: new ApprovalStore(join(dir, "approvals")),
    tools: remoteTools,
    limiter: overrides.limiter ?? new FailureLimiter(),
    allowedHosts: new Set([HOST]),
    allowedOrigins: new Set(),
    isIpAllowed: createIpAllowlist(overrides.allowedIps ?? []),
    audit: (event) => events.push(event),
  });
}

function call(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request(`http://${HOST}/mcp`, {
    method,
    headers: {
      host: HOST,
      "x-forwarded-for": "203.0.113.9",
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    ...(method === "POST" && { body: JSON.stringify(body) }),
  });
}

const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list" };
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test("key store verifies, expires and revokes", () => {
  const { token, record } = keys.create("laptop", "read");
  expect(keys.verify(token)).toEqual({ record });
  expect(keys.verify(token.slice(0, -1) + "A")).toEqual({ reason: "mismatch" });
  expect(keys.verify("nonsense")).toEqual({ reason: "malformed" });
  expect(keys.verify("cpm_00000000_" + "A".repeat(43))).toEqual({ reason: "unknown" });

  const expired = keys.create("old", "read", new Date(Date.now() - 1000));
  expect(keys.verify(expired.token)).toEqual({ reason: "expired" });

  expect(keys.revoke(record.id)).toBe(true);
  expect(keys.verify(token)).toEqual({ reason: "unknown" });
});

test("key store never stores the token and refuses a loose file", () => {
  const { token } = keys.create("laptop", "read");
  expect(Bun.file(join(dir, "keys.json")).text()).resolves.not.toContain(token.split("_")[2]!);
  chmodSync(join(dir, "keys.json"), 0o644);
  expect(() => new KeyStore(join(dir, "keys.json")).list()).toThrow("chmod 600");
});

test("limiter locks out after repeated failures and recovers", () => {
  let now = 0;
  const limiter = new FailureLimiter({ maxFailures: 3, blockMs: 1000, windowMs: 5000, now: () => now });
  for (let i = 0; i < 3; i++) limiter.recordFailure("ip");
  expect(limiter.retryAfterSeconds("ip")).toBe(1);
  now = 1001;
  expect(limiter.retryAfterSeconds("ip")).toBe(0);
});

test("network helpers", () => {
  expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  expect(clientIp(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
  expect(clientIp(new Headers())).toBeNull();
  const allowed = createIpAllowlist(["10.0.0.0/8", "2001:db8::/32"]);
  expect([allowed("10.2.3.4"), allowed("11.0.0.1"), allowed("2001:db8::5")]).toEqual([true, false, true]);
  expect(() => createIpAllowlist(["bogus"])).toThrow("Invalid allowed IP");
});

test("rejects missing, wrong and non-bearer credentials with one generic answer", async () => {
  const handle = handler();
  keys.create("laptop", "read");
  for (const headers of [{}, bearer("cpm_00000000_" + "A".repeat(43)), { authorization: "Basic abc" }]) {
    const response = await handle(call(listTools, headers));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }
});

test("network gates run before authentication", async () => {
  const { token } = keys.create("laptop", "read");
  const handle = handler({ allowedIps: ["198.51.100.0/24"] });
  expect((await handle(call(listTools, bearer(token)))).status).toBe(403);
  expect((await handler()(call(listTools, { ...bearer(token), host: "evil.test" }))).status).toBe(403);
  expect((await handler()(call(listTools, { ...bearer(token), origin: "https://evil.test" }))).status).toBe(403);
  expect((await handler()(call(listTools, { ...bearer(token), "x-forwarded-for": "" }))).status).toBe(403);
  expect((await handler()(call(null, bearer(token), "GET"))).status).toBe(405);
});

test("locks out a client after repeated bad tokens, even for a valid one", async () => {
  const { token } = keys.create("laptop", "read");
  const handle = handler({ limiter: new FailureLimiter({ maxFailures: 3 }) });
  for (let i = 0; i < 3; i++) await handle(call(listTools));
  const response = await handle(call(listTools, bearer(token)));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).not.toBeNull();
});

test("key scope decides which tools exist", async () => {
  const names = async (scope: "read" | "write" | "critical") => {
    const { token } = keys.create(scope, scope);
    const response = await handler()(call(listTools, bearer(token)));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { result: { tools: { name: string }[] } };
    return payload.result.tools.map((tool) => tool.name);
  };
  const read = await names("read");
  const write = await names("write");
  const destroy = await names("critical");
  expect(read).toContain("whm_list_accounts");
  expect(read).not.toContain("whm_create_account");
  expect(write).toContain("whm_create_account");
  expect(write).not.toContain("whm_remove_account");
  expect(destroy).toContain("whm_remove_account");
  expect(destroy).toContain("whm_call");
});

test("a read key cannot call a write tool, and the audit trail records the attempt", async () => {
  const { token, record } = keys.create("laptop", "read");
  globalThis.fetch = (async () =>
    Response.json({ metadata: { result: 1 }, data: { version: "11.1" } })) as unknown as typeof fetch;
  const handle = handler();

  const allowed = await handle(
    call({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "whm_version", arguments: {} } }, bearer(token)),
  );
  expect(JSON.stringify(await allowed.json())).toContain("11.1");

  const denied = await handle(
    call({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whm_remove_account", arguments: { user: "bob" } } }, bearer(token)),
  );
  const payload = (await denied.json()) as { error?: unknown; result?: { isError?: boolean } };
  expect(payload.error ?? payload.result?.isError).toBeTruthy();

  expect(events.map((event) => event.rpc)).toEqual([["tools/call:whm_version"], ["tools/call:whm_remove_account"]]);
  expect(events.every((event) => event.keyId === record.id)).toBe(true);
  expect(JSON.stringify(events)).not.toContain(token);
});

test("audit never contains the WHM token or request secrets", async () => {
  await handler()(call(listTools));
  expect(JSON.stringify(events)).not.toContain("whm-secret");
});
