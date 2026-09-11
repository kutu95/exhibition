import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { sendOrderInvoiceEmail } from "../../../../../../lib/emails/send-order-invoice";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await sendOrderInvoiceEmail(id);
    if (!result.sent) {
      const status = result.error.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      to: result.to,
      invoice_number: result.invoiceNumber,
    });
  } catch (error) {
    return handleRouteError(error, "Send invoice failed");
  }
}
