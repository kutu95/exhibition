import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "./lib/admin-auth";
import { arePurchasesAllowedForHost } from "./lib/purchases-access";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CANONICAL_HOST = "exhibition.margies.app";
const HOSTS_REDIRECT_TO_CANONICAL = new Set([
  "www.exhibition.margies.app",
  "margies.app",
  "www.margies.app",
]);

function shouldForceHttps(request: NextRequest): boolean {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (
    hostname !== CANONICAL_HOST &&
    !HOSTS_REDIRECT_TO_CANONICAL.has(hostname) &&
    !host.includes("exhibition.margies.app")
  ) {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "http";
  }

  // Cloudflare: {"scheme":"http"} or {"scheme":"https"}
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      if (parsed.scheme === "http") return true;
      if (parsed.scheme === "https") return false;
    } catch {
      // ignore malformed header
    }
  }

  return request.nextUrl.protocol === "http:";
}

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0]?.toLowerCase() ?? "";

  // Canonical host: exhibition.margies.app
  if (HOSTS_REDIRECT_TO_CANONICAL.has(hostname)) {
    const canonical = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(canonical, 301);
  }

  if (shouldForceHttps(request)) {
    // Use the public Host header — request.nextUrl can be the internal
    // bind address (e.g. localhost:3007) behind Cloudflare/nginx.
    const host = request.headers.get("host") ?? CANONICAL_HOST;
    const httpsUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${host}`,
    );
    return NextResponse.redirect(httpsUrl, 301);
  }

  const pathname = request.nextUrl.pathname;
  // Prefer absolute Location for trailing-slash redirects (helps crawlers resolve canonical hosts).
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const canonical = new URL(
      `${pathname.replace(/\/+$/, "")}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    );
    if (hostname === CANONICAL_HOST || HOSTS_REDIRECT_TO_CANONICAL.has(hostname)) {
      return NextResponse.redirect(canonical, 308);
    }
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";

  if (isAdminRoute && !isAdminLogin) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const isValidSession = await verifyAdminSessionToken(token);

    if (!isValidSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set(
    "x-purchases-allowed",
    arePurchasesAllowedForHost(hostHeader) ? "1" : "0",
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!supabaseUrl || !supabaseAnonKey || !isAdminRoute) {
    return response;
  }

  // Admin only. Refreshing the Supabase session on public pages added a network
  // round-trip to every request — including every crawl — for a session nothing
  // outside /admin reads.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Parameters<typeof response.cookies.set>[2];
        }>,
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          if (options) {
            response.cookies.set(name, value, options);
          } else {
            response.cookies.set(name, value);
          }
        });
      },
    },
    db: {
      schema: "exhibition",
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)"],
};
