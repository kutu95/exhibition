import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { rebuildPrintOfferVariantsForProduct } from "../../../../../../lib/print-rebuild";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await rebuildPrintOfferVariantsForProduct(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PRODUCT_PIXELS_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Cannot rebuild: master pixels or existing variant dimensions unavailable." },
        { status: 400 },
      );
    }
    return handleRouteError(error, "Admin rebuild product offer failed");
  }
}
