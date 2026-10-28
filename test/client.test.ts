import { afterEach, expect, test } from "bun:test";
import { CpanelClient, CpanelError, toFormBody } from "../src/client";

const config = {
  host: "whm.test",
  port: 2087,
  user: "root",
  token: "secret",
  insecureTls: false,
  timeoutMs: 1000,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function respondWith(body: unknown, capture?: (request: { url: string; init: RequestInit }) => void) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capture?.({ url, init });
    return Response.json(body);
  }) as unknown as typeof fetch;
}

test("toFormBody drops empty values and encodes booleans", () => {
  const body = toFormBody({ a: "x", b: true, c: false, d: undefined, e: null, f: 3 });
  expect(body.toString()).toBe("a=x&b=1&c=0&f=3");
});

test("whm sends token header and form body and returns data", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  respondWith({ metadata: { result: 1 }, data: { ok: true } }, (request) => (seen = request));
  const data = await new CpanelClient(config).whm("version", { x: 1 });
  expect(data).toEqual({ ok: true });
  expect(seen?.url).toBe("https://whm.test:2087/json-api/version");
  expect((seen?.init.headers as Record<string, string>).Authorization).toBe("whm root:secret");
  expect(String(seen?.init.body)).toBe("x=1&api.version=1");
});

test("whm failure surfaces the reason", async () => {
  respondWith({ metadata: { result: 0, reason: "Access denied" } });
  expect(new CpanelClient(config).whm("listaccts")).rejects.toThrow("Access denied");
});

test("uapi unwraps the result and reports UAPI errors", async () => {
  respondWith({ metadata: { result: 1 }, data: { uapi: { status: 1, data: [1], errors: null } } });
  expect(await new CpanelClient(config).uapi("bob", "Email", "list_pops")).toEqual([1]);

  respondWith({
    metadata: { result: 1 },
    data: { uapi: { status: 0, data: null, errors: ["bad domain"] } },
  });
  expect(new CpanelClient(config).uapi("bob", "Email", "list_pops")).rejects.toBeInstanceOf(
    CpanelError,
  );
});
