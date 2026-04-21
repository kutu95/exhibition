import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    exhibition: "SS Georgette — Margaret River Region Open Studios 2026",
  });
}
