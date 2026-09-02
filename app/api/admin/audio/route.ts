import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { groupExistingAudioStories } from "../../../../lib/photo-audio";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, title, slug, audio_url, audio_duration, audio_transcript")
      .not("audio_url", "is", null)
      .order("title");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stories: groupExistingAudioStories(data ?? []) });
  } catch (error) {
    return handleRouteError(error, "Admin audio list failed");
  }
}
