import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json";
import type { ApprovalGate } from "./approval/gate";
import type { CpanelClient } from "./client";
import { failure, success } from "./result";
import { allTools } from "./tools";
import { allModes, type Mode, type ToolDefinition } from "./tools/types";

interface ServerOptions {
  client: CpanelClient;
  modes?: readonly Mode[];
  tools?: readonly ToolDefinition[];
  gate?: ApprovalGate;
}

export function createServer({
  client,
  modes = allModes,
  tools = allTools,
  gate,
}: ServerOptions): McpServer {
  const server = new McpServer({ name: "cpmoshai", version: pkg.version });

  for (const tool of tools.filter((candidate) => modes.includes(candidate.mode))) {
    const gated = Boolean(gate) && tool.mode === "critical";
    server.registerTool(
      tool.name,
      {
        description: gated ? `${tool.description} (requires human 2FA approval)` : tool.description,
        inputSchema: tool.input,
        annotations: {
          readOnlyHint: tool.mode === "read",
          destructiveHint: tool.mode === "critical",
          openWorldHint: true,
        },
      },
      async (args) => {
        try {
          if (gate && gated) return gate.request(tool.name, args);
          return success(await tool.run(args, client));
        } catch (error) {
          return failure(error);
        }
      },
    );
  }

  if (gate && modes.includes("critical")) {
    server.registerTool(
      "approval_status",
      {
        description: "Get the outcome of a tool call that was waiting for human 2FA approval",
        inputSchema: { id: z.string().regex(/^[0-9a-f]{12}$/) },
        annotations: { readOnlyHint: true },
      },
      async ({ id }) => gate.status(id),
    );
  }

  return server;
}
