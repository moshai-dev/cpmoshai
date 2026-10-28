import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approve } from "../src/approval/approve";
import { createGate } from "../src/approval/gate";
import { TotpGuard } from "../src/approval/guard";
import { ApprovalStore } from "../src/approval/store";
import { base32Decode, base32Encode, codeAt, currentStep, generateSecret } from "../src/approval/totp";
import { CpanelClient } from "../src/client";
import { createHandler } from "../src/remote/handler";
import { KeyStore } from "../src/remote/keys";
import { FailureLimiter } from "../src/remote/limiter";
import { remoteTools } from "../src/tools";

const HOST = "mcp.example.com";
const realFetch = globalThis.fetch;
let dir: string;
let now: number;
let fetchCalls: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cpmoshai-approval-"));
  now = Date.UTC(2026, 0, 1);
  fetchCalls = [];
  globalThis.fetch = (async (url: string) => {
    fetchCalls.push(url);
    return Response.json({ metadata: { result: 1 }, data: { done: true } });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rmSync(dir, { recursive: true, force: true });
});

const client = () =>
  new CpanelClient({ host: "whm.test", port: 2087, user: "root", token: "t", insecureTls: false, timeoutMs: 1000 });

test("TOTP matches the RFC 6238 test vector", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  expect(codeAt(secret, currentStep(59_000))).toBe("287082");
  expect(base32Decode(base32Encode(Buffer.from("hello")))).toEqual(Buffer.from("hello"));
});

test("guard accepts a code once, rejects replays, and locks after repeated failures", () => {
  const secret = generateSecret();
  const guard = new TotpGuard(join(dir, "totp.json"), () => now);
  guard.enroll(secret, -1);
  const code = codeAt(secret, currentStep(now));
  expect(guard.verify(code)).toBe("ok");
  expect(guard.verify(code)).toBe("invalid");
  for (let i = 0; i < 4; i++) guard.verify("000000");
  expect(guard.verify(codeAt(secret, currentStep(now) + 1))).toBe("locked");
  now += 16 * 60_000;
  expect(guard.verify(codeAt(secret, currentStep(now)))).toBe("ok");
});

test("store dedupes, caps per key, expires and hides other keys", () => {
  const store = new ApprovalStore(join(dir, "approvals"), { ttlMs: 1000, maxPendingPerKey: 2, now: () => now });
  const first = store.create("whm_remove_account", { user: "bob", keepdns: false }, "k1");
  expect(store.create("whm_remove_account", { keepdns: false, user: "bob" }, "k1").id).toBe(first.id);
  store.create("whm_remove_account", { user: "amy" }, "k1");
  expect(() => store.create("whm_remove_account", { user: "zed" }, "k1")).toThrow("Too many");
  expect(createGate(store, "k2").status(first.id).isError).toBe(true);
  now += 2000;
  expect(store.state(store.get(first.id)!)).toBe("expired");
});

test("approval runs the tool only after a valid 2FA code, and the gate returns the result", async () => {
  const secret = generateSecret();
  const guard = new TotpGuard(join(dir, "totp.json"), () => now);
  guard.enroll(secret, -1);
  const store = new ApprovalStore(join(dir, "approvals"), { now: () => now });
  const deps = { store, guard, client: client(), tools: remoteTools };

  const { id } = store.create("whm_remove_account", { user: "bob" }, "k1");
  expect(await approve(deps, id, "000000")).toMatchObject({ outcome: "invalid-code" });
  expect(fetchCalls).toHaveLength(0);

  const done = await approve(deps, id, codeAt(secret, currentStep(now)));
  expect(done.outcome).toBe("approved");
  expect(fetchCalls).toHaveLength(1);

  const status = createGate(store, "k1").status(id);
  expect(JSON.stringify(status)).toContain("done");
  expect((await approve(deps, id, codeAt(secret, currentStep(now) + 1))).outcome).toBe("not-pending");
});

test("a tool that is not critical can never be approved, and bad arguments never run", async () => {
  const guard = new TotpGuard(join(dir, "totp.json"), () => now);
  guard.enroll(generateSecret(), -1);
  const store = new ApprovalStore(join(dir, "approvals"), { now: () => now });
  const deps = { store, guard, client: client(), tools: remoteTools };
  const read = store.create("whm_version", {}, "k1");
  const bad = store.create("whm_remove_account", { user: 5 }, "k1");
  expect((await approve(deps, read.id, "123456")).outcome).toBe("unknown-tool");
  expect((await approve(deps, bad.id, "123456")).outcome).toBe("invalid-arguments");
  expect(fetchCalls).toHaveLength(0);
});

test("over HTTP a critical call is parked, not executed, and the message never mentions a code", async () => {
  const keys = new KeyStore(join(dir, "keys.json"));
  const { token } = keys.create("admin", "critical");
  const handle = createHandler({
    client: client(),
    keys,
    approvals: new ApprovalStore(join(dir, "approvals"), { now: () => now }),
    tools: remoteTools,
    limiter: new FailureLimiter(),
    allowedHosts: new Set([HOST]),
    allowedOrigins: new Set(),
    isIpAllowed: () => true,
    audit: () => {},
  });
  const rpc = (id: number, name: string, args: unknown) =>
    handle(
      new Request(`http://${HOST}/mcp`, {
        method: "POST",
        headers: {
          host: HOST,
          "x-forwarded-for": "203.0.113.9",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
      }),
    );

  const parked = JSON.stringify(await (await rpc(1, "whm_remove_account", { user: "bob" })).json());
  expect(parked).toContain("Human approval is required");
  expect(fetchCalls).toHaveLength(0);
  const id = /Approval id: ([0-9a-f]{12})/.exec(parked)![1]!;
  expect(JSON.stringify(await (await rpc(2, "approval_status", { id })).json())).toContain("still waiting");
});
