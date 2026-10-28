# cpmoshai

MCP server for cPanel and WHM, built with Bun. It runs on the cPanel server itself, behind Apache, and ships as one compiled binary.

- **102 tools** (54 read-only, 29 write, 19 needing 2FA approval) over WHM API 1 and cPanel UAPI, plus server debugging tools (service status, journal logs, load, disk, memory, processes, ports) and update/end-of-life audits.
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

## Set up 2FA

Needed once, before any critical tool can be approved. Use any TOTP app (Google Authenticator, Authy, 1Password, Aegis).

```bash
cpmoshai totp init
```

1. It prints a **key** and an `otpauth://` **uri**. In your authenticator app choose *Add account > Enter a setup key*, then type the key (account `cpmoshai`, time-based, 6 digits, 30 seconds). If you prefer a QR code, `qrencode -t ANSIUTF8 '<uri>'` renders one.
2. It asks for the current 6-digit code. Enter it to prove the app is set up correctly. Nothing is saved until the code matches.
3. The secret is saved to `/etc/cpmoshai/totp.json` (`root:root 0600`). Keep the server clock accurate (`chronyc tracking`), because codes depend on time.

Using it later:

```bash
cpmoshai pending          # what is waiting
cpmoshai approve a0324b6abb5f
cpmoshai deny a0324b6abb5f
```

Lost your phone? There are no recovery codes by design. As root run `rm /etc/cpmoshai/totp.json` and `cpmoshai totp init` again. The AI cannot do this, because it has no shell on the server.

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

## Update and vulnerability audits

Ask things like "is my PHP safe?" or "what needs updating?". The `audit_*` tools check installed software against its vendor lifecycle and report `ok`, `info`, `warning` or `critical` with a plain recommendation.

| Tool | Checks |
| --- | --- |
| `audit_server` | Everything below in one call, worst first. A failed check is listed, the rest still run. |
| `audit_php` | Each installed `ea-php*` version: exact version, end-of-life and security-support dates, newer patch release, and which sites use it. |
| `audit_cpanel` | cPanel & WHM version against cPanel's release tiers and LTS expiry. |
| `audit_os` | AlmaLinux, Rocky, CentOS, RHEL, CloudLinux (via RHEL) or Ubuntu support dates. |
| `audit_database` | MySQL or MariaDB support dates. |

How to read the result:

- **end-of-life** (critical): no more security fixes, so treat it as vulnerable. Move sites with `whm_php_set_vhost_version`, then remove the old version.
- **security-only** (info, or warning inside 6 months of the end): still patched, but plan the upgrade.
- **patch available** (warning): the installed release is behind the latest one. The recommendation names the update command.

This is a lifecycle check, not a CVE scanner. Data comes from endoflife.date and cPanel's public tier file (cached 12 hours); the only thing sent is the product name, and the server needs outbound HTTPS to `endoflife.date` and `httpupdate.cpanel.net`. PHP versions are read from EasyApache (`/opt/cpanel/ea-php*`); CloudLinux alt-php is not covered.

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
