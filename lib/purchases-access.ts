/**
 * Temporary gate: online purchases only when the visitor is on the LAN.
 *
 * Detection is by Host header — the public site is always exhibition.margies.app
 * (via Cloudflare). LAN access today is the SSH tunnel to localhost:3007, which
 * arrives as Host: localhost. A future direct LAN bind (192.168.x.x) is also
 * treated as allowed. Cloudflare-fronted traffic is never LAN, even from home Wi‑Fi.
 *
 * Flip with PURCHASES_LAN_ONLY=false (or unset) when public sales reopen.
 */

export const PURCHASES_DISABLED_MESSAGE =
  "Online purchases are temporarily unavailable. Prints can be ordered at the exhibition, or via the contact page.";

export function isPurchasesLanOnlyEnabled(): boolean {
  const value = process.env.PURCHASES_LAN_ONLY?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function hostnameFromHostHeader(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  const trimmed = hostHeader.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end >= 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(":")[0] ?? "";
}

export function isLanHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function arePurchasesAllowedForHost(hostHeader: string | null | undefined): boolean {
  if (!isPurchasesLanOnlyEnabled()) return true;
  return isLanHostname(hostnameFromHostHeader(hostHeader));
}

export function arePurchasesAllowedForRequest(request: Request): boolean {
  return arePurchasesAllowedForHost(request.headers.get("host"));
}
