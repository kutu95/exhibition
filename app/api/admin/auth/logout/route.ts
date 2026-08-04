import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, isSecureAdminRequest, verifyAdminSession } from "../../../../../lib/admin-auth";

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecureAdminRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
