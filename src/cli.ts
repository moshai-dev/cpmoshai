#!/usr/bin/env bun
import pkg from "../package.json";
import { approveCommand, deny, pending } from "./commands/approvals";
import { keys } from "./commands/keys";
import { serve } from "./commands/serve";
import { stdio } from "./commands/stdio";
import { totpInit } from "./commands/totp";
import { loadEnvFile } from "./envfile";

const usage = `cpmoshai ${pkg.version}

  serve               run the remote MCP server on a Unix socket
  stdio               run the MCP server over stdio (local use)
  keys <...>          manage client API keys
  totp init           enrol the 2FA authenticator
  pending             list tool calls waiting for approval
  approve <id>        approve one with a 2FA code
  deny <id>           reject one`;

loadEnvFile(process.env.CPMOSHAI_ENV_FILE ?? "/etc/cpmoshai/env");

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "serve":
      serve();
      break;
    case "stdio":
      await stdio();
      break;
    case "keys":
      keys(args);
      break;
    case "totp":
      if (args[0] !== "init") throw new Error(usage);
      await totpInit();
      break;
    case "pending":
      pending();
      break;
    case "approve":
    case "deny":
      if (!args[0]) throw new Error(`${command} needs an approval id`);
      await (command === "approve" ? approveCommand(args[0]) : Promise.resolve(deny(args[0])));
      break;
    case "version":
    case "--version":
      console.log(pkg.version);
      break;
    default:
      console.log(usage);
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
