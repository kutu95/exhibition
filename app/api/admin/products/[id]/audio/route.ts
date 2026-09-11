import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { normalizeAudioFields } from "../../../../../../lib/photo-audio";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

const audioUpdateSchema = z.object({
  audio_url: z.string().nullable().optional(),
  audio_duration: z.string().nullable().optional(),
  audio_transcript: z.string().nullable().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = audioUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid audio payload." }, { status: 400 });
    }

    const audioFields = normalizeAudioFields(parsed.data);
    if (!audioFields.ok) {
      return NextResponse.json({ error: audioFields.error }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: productError?.message ?? "Product not found." }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update({
        audio_url: audioFields.value.audio_url,
        audio_duration: audioFields.value.audio_duration,
        audio_transcript: audioFields.value.audio_transcript,
      })
      .eq("id", id)
      .select("id, audio_url, audio_duration, audio_transcript")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Admin product audio update failed");
  }
}
