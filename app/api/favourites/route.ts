import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../lib/supabase/admin";

const VISITOR_ID_COOKIE = "exhibition_visitor_id";
const VISITOR_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const favouritesSchema = z.object({
  product_id: z.string().uuid(),
  action: z.enum(["add", "remove"]),
  visitor_id: z.string().uuid(),
});

const getCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((segment) => segment.trim());
  const target = `${name}=`;
  const match = pairs.find((pair) => pair.startsWith(target));
  return match ? decodeURIComponent(match.slice(target.length)) : null;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = favouritesSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload." }, { status: 400 });
    }

    const cookieVisitorId = getCookieValue(request.headers.get("cookie"), VISITOR_ID_COOKIE);
    const visitorId = cookieVisitorId && z.string().uuid().safeParse(cookieVisitorId).success
      ? cookieVisitorId
      : parsed.data.visitor_id;

    const { product_id: productId, action } = parsed.data;

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Favourite product lookup failed", productError);
      return NextResponse.json({ success: false, error: "Could not update favourite." }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    if (action === "add") {
      const { error: insertError } = await supabaseAdmin.from("product_favourites").upsert(
        {
          product_id: productId,
          visitor_id: visitorId,
        },
        { onConflict: "product_id,visitor_id", ignoreDuplicates: true },
      );

      if (insertError) {
        console.error("Favourite insert failed", insertError);
        return NextResponse.json({ success: false, error: "Could not update favourite." }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await supabaseAdmin
        .from("product_favourites")
        .delete()
        .eq("product_id", productId)
        .eq("visitor_id", visitorId);

      if (deleteError) {
        console.error("Favourite delete failed", deleteError);
        return NextResponse.json({ success: false, error: "Could not update favourite." }, { status: 500 });
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: VISITOR_ID_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: VISITOR_ID_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    return handleRouteError(error, "Favourites route failed");
  }
}
