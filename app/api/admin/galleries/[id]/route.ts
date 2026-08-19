import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const updateGallerySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
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
    const parsed = updateGallerySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Gallery name is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("galleries")
      .update({
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? "A gallery with that name already exists." : error.message },
        { status: duplicate ? 409 : 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Admin gallery update failed");
  }
}
