import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { getMasterFileDimensions, safeMasterFilename } from "../../../../../lib/master-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filename = new URL(request.url).searchParams.get("filename")?.trim();
  if (!filename) {
    return NextResponse.json({ error: "filename query parameter is required." }, { status: 400 });
  }

  try {
    safeMasterFilename(filename);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid master filename." },
      { status: 400 },
    );
  }

  try {
    const dimensions = await getMasterFileDimensions(filename);
    if (!dimensions) {
      return NextResponse.json({ error: "Could not read dimensions from master TIFF." }, { status: 404 });
    }
    return NextResponse.json({ filename, ...dimensions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read master file dimensions." },
      { status: 500 },
    );
  }
}
