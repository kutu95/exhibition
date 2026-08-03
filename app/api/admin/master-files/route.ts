import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import {
  deleteUnregisteredMasterFile,
  listUnregisteredMasterFiles,
} from "../../../../lib/master-files";

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

export async function DELETE(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filename = new URL(request.url).searchParams.get("filename")?.trim();
  if (!filename) {
    return NextResponse.json({ error: "filename query parameter is required." }, { status: 400 });
  }

  try {
    const result = await deleteUnregisteredMasterFile(filename);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete master TIFF.";
    const status = message.startsWith("Cannot delete")
      ? 409
      : message.includes("not found")
        ? 404
        : message.includes("sidecar") || message.includes("must end") || message.includes("filename only")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
