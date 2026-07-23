import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { getTalkCapacity, setTalkCapacity } from "../../../../../lib/talk-registration";

const capacitySchema = z.object({
  capacity: z.number().int().min(1).max(500),
});

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const capacity = await getTalkCapacity();
    return NextResponse.json({ capacity });
  } catch (error) {
    return handleRouteError(error, "Admin talk capacity GET failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = capacitySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Capacity must be a whole number between 1 and 500." }, { status: 400 });
    }

    const capacity = await setTalkCapacity(parsed.data.capacity);
    return NextResponse.json({ capacity });
  } catch (error) {
    return handleRouteError(error, "Admin talk capacity PATCH failed");
  }
}
