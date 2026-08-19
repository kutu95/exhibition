import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { slugify } from "../../../../lib/utils/slugify";

const createGallerySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.from("galleries").select("*").order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return handleRouteError(error, "Admin galleries list failed");
  }
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createGallerySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Gallery name is required." }, { status: 400 });
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    return NextResponse.json({ error: "Gallery name must contain letters or numbers." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("galleries")
      .insert({
        name: parsed.data.name,
        slug,
        description: parsed.data.description?.trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? "A gallery with that name already exists." : error.message },
        { status: duplicate ? 409 : 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Admin gallery creation failed");
  }
}
