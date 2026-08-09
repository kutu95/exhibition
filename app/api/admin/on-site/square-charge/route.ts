import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import {
  getSquareApplicationId,
  isSquarePosConfigured,
  pickSquarePosUrl,
} from "../../../../../lib/square-pos";

export const runtime = "nodejs";

const schema = z.object({
  amount_cents: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  client_transaction_id: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSquarePosConfigured()) {
    return NextResponse.json(
      { error: "SQUARE_APPLICATION_ID is not configured." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SITE_URL." }, { status: 500 });
  }

  const callbackUrl = `${siteUrl.replace(/\/$/, "")}/admin/on-site/square-return`;
  const userAgent = request.headers.get("user-agent") ?? "";

  try {
    const posUrl = pickSquarePosUrl(userAgent, {
      amountCents: parsed.data.amount_cents,
      callbackUrl,
      note: parsed.data.note,
      clientTransactionId: parsed.data.client_transaction_id,
    });

    return NextResponse.json({
      url: posUrl,
      application_id: getSquareApplicationId(),
      callback_url: callbackUrl,
    });
  } catch (error) {
    console.error("Square POS URL build failed", error);
    return NextResponse.json({ error: "Could not build Square charge link." }, { status: 500 });
  }
}
