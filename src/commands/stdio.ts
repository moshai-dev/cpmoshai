import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CpanelClient } from "../client";
import { loadConfig } from "../config";
import { createServer } from "../server";

export async function stdio(): Promise<void> {
  const server = createServer({ client: new CpanelClient(loadConfig()) });
  await server.connect(new StdioServerTransport());
}
