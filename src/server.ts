import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CpanelClient } from "./client";
import { failure, success } from "./result";
import { allTools } from "./tools";

export function createServer(client: CpanelClient): McpServer {
  const server = new McpServer({ name: "cpmoshai", version: "0.1.0" });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          readOnlyHint: tool.mode === "read",
          destructiveHint: tool.mode === "destroy",
          openWorldHint: true,
        },
      },
      async (args) => {
        try {
          return success(await tool.run(args, client));
        } catch (error) {
          return failure(error);
        }
      },
    );
  }

  return server;
}
