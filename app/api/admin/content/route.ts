import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
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

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("*, media_files(*)")
    .order("content_key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as SiteContentWithMedia[]);
}
