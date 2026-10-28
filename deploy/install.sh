#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; exit 1; }

here=$(cd "$(dirname "$0")" && pwd)
(cd "$here" && sha256sum --check cpmoshai.sha256)

id cpmoshai >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin cpmoshai

install -m 0755 "$here/cpmoshai" /usr/local/bin/cpmoshai
install -d -m 0755 /etc/cpmoshai
[ -e /etc/cpmoshai/env ] || install -m 0644 "$here/env.example" /etc/cpmoshai/env
install -m 0644 "$here/cpmoshai.service" /etc/systemd/system/cpmoshai.service
systemctl daemon-reload

cat <<'NEXT'
Installed. Remaining steps:
  1. Save a WHM API token:  install -m 0600 -o cpmoshai /dev/null /etc/cpmoshai/whm-token && edit it
  2. Edit /etc/cpmoshai/env (host, allowed hosts)
  3. cpmoshai totp init
  4. cpmoshai keys create <name> --scope read
  5. systemctl enable --now cpmoshai
  6. Install deploy/apache-mcp.conf for your MCP domain
NEXT
