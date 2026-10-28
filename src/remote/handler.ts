import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createGate } from "../approval/gate";
import type { ApprovalStore } from "../approval/store";
import type { CpanelClient } from "../client";
import { createServer } from "../server";
import type { ToolDefinition } from "../tools/types";
import type { Audit, AuditEvent } from "./audit";
import { KeyStore, modesForScope } from "./keys";
import type { FailureLimiter } from "./limiter";
import { clientIp } from "./network";

export interface HandlerDeps {
  client: CpanelClient;
  keys: KeyStore;
  approvals: ApprovalStore;
  tools: readonly ToolDefinition[];
  limiter: FailureLimiter;
  allowedHosts: ReadonlySet<string>;
  allowedOrigins: ReadonlySet<string>;
  isIpAllowed: (ip: string) => boolean;
  audit: Audit;
}

const MCP_PATH = "/mcp";
const MAX_BODY_BYTES = 1_048_576;
const MESSAGES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  413: "Payload too large",
  415: "Unsupported media type",
  429: "Too many failed attempts",
  500: "Internal error",
};

function rpcLabels(body: unknown): string[] {
  return (Array.isArray(body) ? body : [body]).flatMap((message) => {
    if (typeof message !== "object" || message === null) return [];
    const { method, params } = message as { method?: unknown; params?: { name?: unknown } };
    if (typeof method !== "string") return [];
    return method === "tools/call" && typeof params?.name === "string"
      ? [`tools/call:${params.name}`]
      : [method];
  });
}

function reject(
  event: AuditEvent,
  status: number,
  reason: string,
  headers: Record<string, string> = {},
): Response {
  event.reason = reason;
  return Response.json({ error: MESSAGES[status] }, { status, headers });
}

async function serve(
  deps: HandlerDeps,
  request: Request,
  ip: string | null,
  event: AuditEvent,
): Promise<Response> {
  if (!ip || !deps.isIpAllowed(ip)) return reject(event, 403, "ip not allowed");
  if (!deps.allowedHosts.has((request.headers.get("host") ?? "").toLowerCase())) {
    return reject(event, 403, "host not allowed");
  }
  const origin = request.headers.get("origin");
  if (origin && !deps.allowedOrigins.has(origin)) return reject(event, 403, "origin not allowed");
  if (new URL(request.url).pathname !== MCP_PATH) return reject(event, 404, "unknown path");
  if (request.method !== "POST") return reject(event, 405, "method not allowed", { Allow: "POST" });

  const retryAfter = deps.limiter.retryAfterSeconds(ip);
  if (retryAfter > 0) return reject(event, 429, "locked out", { "Retry-After": String(retryAfter) });

  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const verification = token ? deps.keys.verify(token) : ({ reason: "missing" } as const);
  if (!("record" in verification)) {
    deps.limiter.recordFailure(ip);
    return reject(event, 401, `auth ${verification.reason}`, { "WWW-Authenticate": "Bearer" });
  }
  deps.limiter.recordSuccess(ip);
  const { record } = verification;
  event.keyId = record.id;

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return reject(event, 415, "content type");
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reject(event, 413, "body too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(event, 400, "invalid json");
  }
  event.rpc = rpcLabels(body);

  const server = createServer({
    client: deps.client,
    modes: modesForScope[record.scope],
    tools: deps.tools,
    gate: createGate(deps.approvals, record.id),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, { parsedBody: body });
  } finally {
    await server.close();
  }
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const ip = clientIp(request.headers);
    const event: AuditEvent = { ip, status: 500 };
    let response: Response;
    try {
      response = await serve(deps, request, ip, event);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      response = reject(event, 500, "internal error");
    }
    event.status = response.status;
    deps.audit(event);
    return response;
  };
}
