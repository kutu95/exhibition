#!/usr/bin/env bash
# Run on the Ubuntu host. Safely ADDS alias host ingress rules without
# removing other apps on the shared tunnel.
set -euo pipefail

APP_PORT="${APP_PORT:-3007}"
ORIGIN="http://127.0.0.1:${APP_PORT}"
ALIASES=(
  "www.exhibition.margies.app"
)

resolve_config() {
  if [[ -f "$HOME/.cloudflared/config.yml" ]]; then
    # Prefer the live user config used by systemd on this host
    echo "$HOME/.cloudflared/config.yml"
  elif [[ -f /etc/cloudflared/config.yml ]]; then
    echo /etc/cloudflared/config.yml
  else
    echo "No cloudflared config found" >&2
    exit 1
  fi
}

CONFIG="$(resolve_config)"
BACKUP="${CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$CONFIG" "$BACKUP"
echo "→ Using $CONFIG (backup $BACKUP)"

python3 - "$CONFIG" "$ORIGIN" "${ALIASES[@]}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
origin = sys.argv[2]
aliases = sys.argv[3:]
text = path.read_text()

missing = [h for h in aliases if f"hostname: {h}" not in text]
if not missing:
    print("All alias hostnames already present — nothing to change")
    raise SystemExit(0)

block_lines = []
for host in missing:
    block_lines.extend([
        f"  - hostname: {host}",
        f"    service: {origin}",
        "    originRequest:",
        "      connectTimeout: 30s",
        f"      httpHostHeader: {host}",
        "",
    ])
block = "\n".join(block_lines)

marker = (
    "  - hostname: exhibition.margies.app\n"
    f"    service: {origin}\n"
)
# tolerate slight originRequest order differences by finding the exhibition hostname line
idx = text.find("  - hostname: exhibition.margies.app\n")
if idx < 0:
    raise SystemExit("Could not find exhibition.margies.app in config")

# Insert after the exhibition block: find next "  - hostname:" or catch-all after this entry
rest = text[idx:]
# end of this ingress item = next line starting with "  - " after the first line
lines = rest.splitlines(keepends=True)
end = len(lines[0])
for line in lines[1:]:
    if line.startswith("  - "):
        break
    end += len(line)

insert_at = idx + end
new_text = text[:insert_at] + block + text[insert_at:]
path.write_text(new_text)
print("Added:")
for h in missing:
    print(f"  - {h} → {origin}")
PY

echo "→ Restart cloudflared with: echo '<password>' | sudo -S systemctl restart cloudflared"
echo "  (or: sudo systemctl restart cloudflared)"
echo
echo "DNS notes:"
echo "  • www.margies.app  → add proxied CNAME in Cloudflare zone margies.app (same target as exhibition)"
echo "  • www.exhibition.margies.app needs Advanced Certificate / Total TLS (Universal SSL is *.margies.app only)"
echo "  • Do NOT use: cloudflared tunnel route dns … without confirming the zone — it may create *.landlife.au records"
