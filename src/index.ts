#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CpanelClient } from "./client";
import { loadConfig } from "./config";
import { createServer } from "./server";

try {
  const server = createServer(new CpanelClient(loadConfig()));
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
