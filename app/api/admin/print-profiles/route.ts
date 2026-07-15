import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { resolvePrivateStoragePath } from "../../../../lib/private-storage";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import type { PrintProfile } from "../../../../lib/supabase/types";

export const runtime = "nodejs";

const MAX_PROFILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".icc", ".icm"]);

const metadataSchema = z.object({
  display_name: z.string().min(1),
  profile_role: z.enum(["source", "destination"]),
  colour_space: z.string().nullable(),
  paper_type: z.string().nullable(),
  print_type: z.string().nullable(),
  is_active: z.boolean(),
});

const stringField = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const booleanField = (formData: FormData, key: string, fallback: boolean): boolean => {
  const value = formData.get(key);
  if (typeof value !== "string") return fallback;
  return value === "true";
};

const hasIccSignature = (buffer: Buffer): boolean =>
  buffer.length > 40 && buffer.subarray(36, 40).toString("ascii") === "acsp";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("print_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as PrintProfile[]);
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileField = formData.get("file");

  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "ICC/ICM file is required." }, { status: 400 });
  }

  const extension = path.extname(fileField.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Only .icc and .icm files are supported." }, { status: 400 });
  }

  if (fileField.size > MAX_PROFILE_BYTES) {
    return NextResponse.json({ error: "ICC profile exceeds 25MB limit." }, { status: 400 });
  }

  const metadata = metadataSchema.safeParse({
    display_name: stringField(formData, "display_name") ?? path.basename(fileField.name, extension),
    profile_role: stringField(formData, "profile_role") ?? "destination",
    colour_space: stringField(formData, "colour_space"),
    paper_type: stringField(formData, "paper_type"),
    print_type: stringField(formData, "print_type"),
    is_active: booleanField(formData, "is_active", true),
  });

  if (!metadata.success) {
    return NextResponse.json({ error: "Invalid print profile metadata." }, { status: 400 });
  }

  const buffer = Buffer.from(await fileField.arrayBuffer());
  if (!hasIccSignature(buffer)) {
    return NextResponse.json({ error: "File does not look like a valid ICC profile." }, { status: 400 });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const filename = `${randomUUID().toLowerCase()}${extension}`;
  const storagePath = `icc/${filename}`;
  const targetPath = resolvePrivateStoragePath(storagePath);

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const { data, error } = await supabaseAdmin
    .from("print_profiles")
    .insert({
      ...metadata.data,
      filename,
      original_filename: fileField.name,
      file_size_bytes: fileField.size,
      storage_path: storagePath,
      checksum_sha256: checksum,
    })
    .select("*")
    .single();

  if (error || !data) {
    await fs.unlink(targetPath).catch(() => undefined);
    const duplicate = error?.code === "23505" ? " This profile may already have been uploaded." : "";
    return NextResponse.json(
      { error: `${error?.message ?? "Failed to save print profile."}${duplicate}` },
      { status: error?.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(data as PrintProfile, { status: 201 });
}
