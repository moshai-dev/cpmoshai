# cpmoshai

MCP server for cPanel and WHM, built with Bun and the official TypeScript SDK. It talks to WHM API 1 and to cPanel UAPI through the WHM `uapi_cpanel` function, so one root or reseller API token covers both.

## Setup

```bash
bun install
```

Create a WHM API token under **Development > Manage API Tokens**, then register the server:

```bash
claude mcp add cpmoshai \
  -e CPANEL_HOST=server.example.com \
  -e CPANEL_USER=root \
  -e CPANEL_TOKEN=your-token \
  -- bun run /absolute/path/to/cpmoshai/src/index.ts
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `CPANEL_HOST` | required | Server hostname, no scheme or port |
| `CPANEL_PORT` | `2087` | WHM port |
| `CPANEL_USER` | `root` | WHM user that owns the token |
| `CPANEL_TOKEN` | required | WHM API token |
| `CPANEL_INSECURE_TLS` | `false` | Accept a self-signed certificate |
| `CPANEL_TIMEOUT_MS` | `30000` | Per-request timeout |

## Tools

`whm_*` tools call WHM API 1: accounts, packages, DNS zones, server and services, PHP versions, SSL and AutoSSL, resellers, backups.

`cpanel_*` tools call UAPI as an account, so each takes an `account` argument: email, MySQL, FTP, files, SSL, backups, quota and domains.

`whm_call` and `cpanel_uapi_call` reach any function that has no dedicated tool.

Tools carry MCP annotations: reads are `readOnlyHint`, deletes and overwrites are `destructiveHint`, so clients can ask before running them.

## Layout

```
src/
  index.ts      stdio entry point
  server.ts     registers tools on the MCP server
  config.ts     environment parsing
  client.ts     WHM and UAPI HTTP client
  result.ts     tool result formatting
  tools/
    builders.ts whmTool and uapiTool helpers
    whm/        WHM API 1 tools by area
    cpanel/     UAPI tools by area
    raw.ts      generic passthrough tools
```

## Development

```bash
bun run typecheck
bun test
```

Logs go to stderr only; stdout carries the protocol.
