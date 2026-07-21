import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  data: z.string().url().max(2048),
  size: z.coerce.number().int().min(128).max(1024).optional().default(512),
});

/**
 * Public QR PNG generator for exhibition wall links.
 * Only encodes absolute http(s) URLs so it cannot be used as an arbitrary data encoder.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    data: url.searchParams.get("data") ?? undefined,
    size: url.searchParams.get("size") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid absolute http(s) URL as data." }, { status: 400 });
  }

  const target = new URL(parsed.data.data);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are allowed." }, { status: 400 });
  }

  const png = await QRCode.toBuffer(parsed.data.data, {
    type: "png",
    width: parsed.data.size,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
