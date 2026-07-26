#!/usr/bin/env bash
# Run on the Ubuntu host (john@…) after pulling this repo.
# Ensures cloudflared routes alias hosts to the exhibition app so middleware
# can 301 them to https://exhibition.margies.app.
set -euo pipefail

APP_PORT="${APP_PORT:-3007}"
ORIGIN="http://127.0.0.1:${APP_PORT}"

resolve_config() {
  if [[ -f /etc/cloudflared/config.yml ]]; then
    echo /etc/cloudflared/config.yml
  elif [[ -f "$HOME/.cloudflared/config.yml" ]]; then
    echo "$HOME/.cloudflared/config.yml"
  else
    echo "No cloudflared config found at /etc/cloudflared/config.yml or ~/.cloudflared/config.yml" >&2
    exit 1
  fi
}

CONFIG="$(resolve_config)"
BACKUP="${CONFIG}.bak.$(date +%Y%m%d%H%M%S)"

echo "→ Using config: $CONFIG"
cp -a "$CONFIG" "$BACKUP"
echo "→ Backup: $BACKUP"

python3 - "$CONFIG" "$ORIGIN" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
origin = sys.argv[2]
text = path.read_text()

required = [
    "exhibition.margies.app",
    "www.exhibition.margies.app",
    "margies.app",
    "www.margies.app",
]

# Preserve tunnel + credentials header; rebuild ingress block.
lines = text.splitlines()
header: list[str] = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.strip() == "ingress:" or line.startswith("ingress:"):
        break
    header.append(line)
    i += 1

def host_block(hostname: str) -> list[str]:
    return [
        f"  - hostname: {hostname}",
        f"    service: {origin}",
        "    originRequest:",
        "      noTLSVerify: false",
        "      connectTimeout: 30s",
        f"      httpHostHeader: {hostname}",
    ]

ingress = ["ingress:"]
for host in required:
    ingress.extend(host_block(host))
ingress.append("  - service: http_status:404")

# Keep a trailing newline
new_text = "\n".join([*header, "", *ingress, ""])
path.write_text(new_text)
print("→ Wrote updated ingress for:")
for host in required:
    print(f"   - {host} → {origin}")
PY

echo "→ Restarting cloudflared"
if systemctl list-unit-files 2>/dev/null | grep -q '^cloudflared\.service'; then
  sudo systemctl restart cloudflared
  sudo systemctl --no-pager --full status cloudflared | sed -n '1,20p'
else
  echo "cloudflared systemd unit not found — restart the tunnel process manually." >&2
  exit 1
fi

echo
echo "✓ Tunnel config updated."
echo "  Also ensure Cloudflare DNS has proxied records for:"
echo "    exhibition → (existing tunnel CNAME)"
echo "    www.exhibition → same tunnel target"
echo "    @ (margies.app) → same tunnel target (or Redirect Rule)"
echo "    www → same tunnel target"
echo "  And add matching Public Hostnames in Zero Trust → Tunnels if DNS was created there."
