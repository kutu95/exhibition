import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { getPrintPapers, setPrintPapers } from "../../../../../lib/print-papers";

const paperSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  printType: z.enum(["fine_art", "photo", "canvas", "metal"]),
  ratePerSqInAud: z.number().min(0).max(100).nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

const papersSchema = z.object({
  papers: z.array(paperSchema).min(1),
});

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const papers = await getPrintPapers();
    return NextResponse.json({ papers });
  } catch (error) {
    return handleRouteError(error, "Admin print papers GET failed");
  }
}

export async function PUT(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = papersSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid papers payload. Each paper needs id, label, print type, and rate (or null)." },
        { status: 400 },
      );
    }

    const papers = await setPrintPapers(parsed.data.papers);
    return NextResponse.json({ papers });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleRouteError(error, "Admin print papers PUT failed");
  }
}
