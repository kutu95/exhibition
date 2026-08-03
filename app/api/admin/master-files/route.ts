import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { listUnregisteredMasterFiles } from "../../../../lib/master-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sidecar purge runs inside listUnregisteredMasterFiles (macOS ._ AppleDouble junk).
    const files = await listUnregisteredMasterFiles();
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan master files." },
      { status: 500 },
    );
  }
}
