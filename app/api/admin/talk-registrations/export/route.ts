import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const csvEscape = (value: string | number | null): string => {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("talk_registrations")
    .select("email,name,party_size,source,created_at,cancelled_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines = ["email,name,party_size,source,created_at,cancelled_at"];
  (data ?? []).forEach((row) => {
    lines.push(
      [
        csvEscape(row.email),
        csvEscape(row.name),
        csvEscape(row.party_size),
        csvEscape(row.source),
        csvEscape(row.created_at),
        csvEscape(row.cancelled_at),
      ].join(","),
    );
  });

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=talk-registrations.csv",
    },
  });
}
