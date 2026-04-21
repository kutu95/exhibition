import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const csvEscape = (value: string | null): string => {
  if (!value) return "";
  return `"${value.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("email_subscribers")
    .select("email,first_name,source,subscribed_at,is_confirmed")
    .order("subscribed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines = ["email,first_name,source,subscribed_at,confirmed"];
  (data ?? []).forEach((row) => {
    lines.push(
      [
        csvEscape(row.email),
        csvEscape(row.first_name),
        csvEscape(row.source),
        csvEscape(row.subscribed_at),
        row.is_confirmed ? "true" : "false",
      ].join(","),
    );
  });

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=subscribers.csv",
    },
  });
}
