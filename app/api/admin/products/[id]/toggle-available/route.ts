import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("is_available")
    .eq("id", id)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json({ error: productError?.message ?? "Product not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({ is_available: !product.is_available })
    .eq("id", id)
    .select("id,is_available")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
