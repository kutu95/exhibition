import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { backfillMissingInstallationImageRows } from "../../../../lib/site-content-backfill";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import type { MediaFile, SiteContent } from "../../../../lib/supabase/types";

type SiteContentWithMedia = SiteContent & {
  media_files: MediaFile | null;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: firstData, error: firstError } = await supabaseAdmin
    .from("site_content")
    .select("*, media_files(*)")
    .order("content_key", { ascending: true });

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const existingKeys = new Set((firstData ?? []).map((row) => row.content_key));
  const shouldRefetch = await backfillMissingInstallationImageRows(supabaseAdmin, existingKeys);

  const { data, error } = shouldRefetch
    ? await supabaseAdmin
        .from("site_content")
        .select("*, media_files(*)")
        .order("content_key", { ascending: true })
    : { data: firstData, error: null as null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as SiteContentWithMedia[]);
}
