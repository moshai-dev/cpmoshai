import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_CHARS = 50_000;

function text(value: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: value }], ...(isError && { isError }) };
}

export function success(value: unknown): CallToolResult {
  const json = JSON.stringify(value, null, 2) ?? "null";
  if (json.length <= MAX_CHARS) return text(json);
  return text(`${json.slice(0, MAX_CHARS)}\n… truncated ${json.length - MAX_CHARS} characters`);
}

export function failure(error: unknown): CallToolResult {
  return text(error instanceof Error ? error.message : String(error), true);
}
