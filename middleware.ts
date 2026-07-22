import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "./lib/admin-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function shouldForceHttps(request: NextRequest): boolean {
  const host = request.headers.get("host") ?? "";
  if (!host.includes("exhibition.margies.app")) {
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
  if (shouldForceHttps(request)) {
    // Use the public Host header — request.nextUrl can be the internal
    // bind address (e.g. localhost:3007) behind Cloudflare/nginx.
    const host = request.headers.get("host") ?? "exhibition.margies.app";
    const httpsUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${host}`,
    );
    return NextResponse.redirect(httpsUrl, 301);
  }

  const pathname = request.nextUrl.pathname;
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

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

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
