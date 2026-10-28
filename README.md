# cpmoshai

MCP server for cPanel and WHM, built with Bun. It runs on the cPanel server itself, behind Apache, and ships as one compiled binary.

- **97 tools** (49 read-only, 29 write, 19 needing 2FA approval) over WHM API 1 and cPanel UAPI, plus server debugging tools (service status, journal logs, load, disk, memory, processes, ports).
- **Layered authentication** for remote access, and **human 2FA approval** for dangerous calls that the AI client can never see or answer.

## Security model

| Layer | What it does |
| --- | --- |
| Unix socket | The server has no TCP port. Only Apache (group `nobody`) can reach `/run/cpmoshai/mcp.sock`. |
| TLS | Apache terminates HTTPS with an AutoSSL certificate and sends HSTS. |
| Host, Origin, IP checks | Wrong `Host` or any unlisted `Origin` is refused (DNS-rebinding defence). Optional CIDR allowlist. |
| API keys | `cpm_<id>_<secret>`: 256-bit secrets, stored only as SHA-256 hashes, constant-time compare, optional expiry, revocation takes effect immediately. |
| Scopes | A key is `read`, `write` or `critical`. Tools above a key's scope are not even listed to it. |
| Lockout | 5 bad credentials from one IP block it for 15 minutes, before any key is checked. |
| 2FA approval | `critical` tools never run on the AI's request. They are parked until a human approves them on the server with a TOTP code. |
| Audit log | One JSON line per request (IP, key id, RPC method, tool name, status) on stderr / journald. No secrets, no arguments. |
| Process hardening | Dedicated user, no capabilities, read-only filesystem, syscall filter (see `deploy/cpmoshai.service`). |
| WHM token | Read from a `0600` file, never from the environment in remote mode. |

### How 2FA approval keeps the code from the AI

1. The AI calls a `critical` tool such as `whm_remove_account`. The server does **not** run it. It stores a pending request and returns an approval id.
2. A human logs in to the server and runs `cpmoshai approve <id>`. The command shows what will run (secrets redacted), then asks for the TOTP code on a real terminal. It refuses piped input.
3. The code goes from the human to that command only. It never passes through MCP, the HTTP endpoint or the AI client. The TOTP secret is `root:root 0600`, so even the service process cannot read it.
4. The command checks the code, runs the exact stored call, and records the result. The AI then calls `approval_status` with the id to fetch the outcome.

Codes are single-use, 5 wrong codes lock approvals for 15 minutes, requests expire after 5 minutes, and a result is only visible to the key that asked.

`critical` tools: account termination, suspension, password changes, login-session creation, reseller setup, package, DNS zone and record deletion, mailbox, database, FTP and SSL deletion, file overwrite, and the generic `whm_call` / `cpanel_uapi_call`.

## Build

Run the **Build binary** workflow from the Actions tab (manual only). It type-checks, tests, compiles a standalone binary, writes a checksum and a build provenance attestation, and uploads everything as an artifact.

## Install on the server

Download the artifact, copy it to the server, extract it, then as root:

```bash
./install.sh
```

Follow the steps it prints:

1. Create a WHM API token (**Development > Manage API Tokens**) with only the ACLs you need, and save it:
   ```bash
   install -m 0600 -o cpmoshai /dev/null /etc/cpmoshai/whm-token
   nano /etc/cpmoshai/whm-token
   ```
2. Edit `/etc/cpmoshai/env`: `CPANEL_HOST` (the server hostname that matches its certificate) and `CPMOSHAI_ALLOWED_HOSTS` (the public MCP hostname).
3. Enrol 2FA (scan or type the key into an authenticator app, then confirm with a code):
   ```bash
   cpmoshai totp init
   ```
4. Create a client key. The token is shown once:
   ```bash
   cpmoshai keys create laptop --scope write --expires-days 90
   ```
5. Start it: `systemctl enable --now cpmoshai`
6. Create an AutoSSL subdomain such as `mcp.example.com`, then install `deploy/apache-mcp.conf` as described in that file.

Optional settings in `/etc/cpmoshai/env`: `CPMOSHAI_ALLOWED_IPS` (comma-separated CIDRs), `CPMOSHAI_ALLOWED_ORIGINS`, `CPMOSHAI_SOCKET`, `CPMOSHAI_STATE_DIR`, `CPMOSHAI_TOTP_FILE`, `CPANEL_INSECURE_TLS`.

## Connect a client

```bash
claude mcp add --transport http cpanel https://mcp.example.com/mcp \
  --header "Authorization: Bearer cpm_xxxxxxxx_..."
```

## Commands

```
cpmoshai serve            run the remote server
cpmoshai stdio            run over stdio for local use (CPANEL_HOST, CPANEL_TOKEN)
cpmoshai keys create|list|revoke
cpmoshai totp init
cpmoshai pending          list calls waiting for approval
cpmoshai approve <id>     approve one with a 2FA code
cpmoshai deny <id>
```

Run `cpmoshai` as root for `totp`, `approve` and `keys`; files stay owned by the right account.

## Tools

`whm_*` cover accounts, packages, DNS, server settings, services, PHP versions, SSL and AutoSSL, resellers and backups. `cpanel_*` take an `account` argument and cover email, MySQL, FTP, files, SSL, backups, quota and domains. `system_*` (remote mode only) are read-only: service status, journal logs, failed units, disk, memory, uptime, top processes, listening ports. `whm_restart_service` only restarts an allowlist of services.

## Development

```bash
bun install
bun run typecheck
bun test
bun run cli stdio
```

Logs go to stderr only; on stdio, stdout carries the protocol.
