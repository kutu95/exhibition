import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { resolveMasterFilePath, safeMasterFilename } from "../../../../lib/master-files";
import { resolveCanonicalMediaPath } from "../../../../lib/media-storage";
import {
  isDuplicateProductSlugError,
  isStripeConfigurationError,
  registerPrintProduct,
} from "../../../../lib/product-registration";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { generateWebImageFromMaster } from "../../../../lib/web-image-generation";

export const runtime = "nodejs";

const photoTypeOptions = ["Still camera", "Drone", "Underwater"] as const;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const maxImageBytes = 8 * 1024 * 1024;

const formSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  location_tag: z.string().nullable(),
  photo_type_tag: z.enum(photoTypeOptions).nullable(),
  is_featured: z.boolean(),
  edition_size: z.number().int().positive(),
  master_filename: z.string().min(1),
  variant_template_ids: z.array(z.string().uuid()).min(1),
  variant_template_prices: z.record(z.string().uuid(), z.number().int().nonnegative()),
  theme_ids: z.array(z.string().uuid()),
});

const stringField = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const booleanField = (formData: FormData, key: string): boolean => formData.get(key) === "true";

const variantTemplateIdsField = (formData: FormData): string[] => {
  const rawValues = formData.getAll("variant_template_ids");
  return rawValues.flatMap((value) => {
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [value];
    } catch {
      return value ? [value] : [];
    }
  });
};

const themeIdsField = (formData: FormData): string[] => {
  const value = formData.get("theme_ids");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const variantTemplatePricesField = (formData: FormData): Record<string, number> => {
  const value = formData.get("variant_template_prices");
  if (typeof value !== "string" || !value.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed).flatMap(([templateId, price]) =>
      typeof price === "number" ? [[templateId, price]] : [],
    ),
  );
};

type SavedWebImage = {
  urlPath: string;
  mediaId: string;
  filePath: string;
};

const insertMediaRecord = async (
  filename: string,
  originalFilename: string,
  mimeType: string,
  fileSize: number,
  urlPath: string,
  title: string,
  slug: string,
): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .insert({
      filename,
      original_filename: originalFilename,
      file_type: "image",
      mime_type: mimeType,
      file_size_bytes: fileSize,
      url_path: urlPath,
      width: null,
      height: null,
      duration_seconds: null,
      alt_text: title,
      usage_note: `Admin registered photo for ${slug}`,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "FAILED_MEDIA_METADATA");
  }

  return data.id;
};

const saveUploadedWebImage = async (file: File, slug: string, title: string): Promise<SavedWebImage> => {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("INVALID_WEB_IMAGE_TYPE");
  }

  if (file.size > maxImageBytes) {
    throw new Error("WEB_IMAGE_TOO_LARGE");
  }

  const extension = extensionByMimeType[file.type];
  const filename = `${slug}-${randomUUID().toLowerCase()}${extension}`;
  const urlPath = `/images/${filename}`;
  const filePath = resolveCanonicalMediaPath(urlPath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  try {
    const mediaId = await insertMediaRecord(filename, file.name, file.type, file.size, urlPath, title, slug);
    return { urlPath, mediaId, filePath };
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }
};

const generateWebImage = async (masterFilename: string, slug: string, title: string): Promise<SavedWebImage> => {
  const filename = `${slug}-${randomUUID().toLowerCase()}.jpg`;
  const urlPath = `/images/${filename}`;
  const filePath = resolveCanonicalMediaPath(urlPath);
  const masterPath = resolveMasterFilePath(masterFilename);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await generateWebImageFromMaster(masterPath, filePath);

  try {
    const stat = await fs.stat(filePath);
    const mediaId = await insertMediaRecord(filename, filename, "image/jpeg", stat.size, urlPath, title, slug);
    return { urlPath, mediaId, filePath };
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }
};

const masterFileErrorResponse = (error: unknown, masterFilename: string): NextResponse => {
  if (error instanceof Error && error.message.toLowerCase().includes("master files directory")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (
    error instanceof Error &&
    (
      error.message === "Master filename must be a filename only, not a path." ||
      error.message === "Master filename must end in .tif or .tiff."
    )
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: `Master TIFF was not found in MASTER_FILES_DIR: ${masterFilename}` },
    { status: 400 },
  );
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const webImage = formData.get("web_image");

  const parsed = formSchema.safeParse({
    title: stringField(formData, "title"),
    slug: stringField(formData, "slug"),
    description: stringField(formData, "description"),
    location_tag: stringField(formData, "location_tag"),
    photo_type_tag: stringField(formData, "photo_type_tag"),
    is_featured: booleanField(formData, "is_featured"),
    edition_size: Number.parseInt(stringField(formData, "edition_size") ?? "", 10),
    master_filename: stringField(formData, "master_filename"),
    variant_template_ids: variantTemplateIdsField(formData),
    variant_template_prices: variantTemplatePricesField(formData),
    theme_ids: themeIdsField(formData),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid photo registration payload." }, { status: 400 });
  }

  try {
    const safeFilename = safeMasterFilename(parsed.data.master_filename);
    await fs.access(resolveMasterFilePath(safeFilename));
  } catch (error) {
    return masterFileErrorResponse(error, parsed.data.master_filename);
  }

  let savedImage: SavedWebImage | null = null;
  try {
    savedImage = webImage instanceof File && webImage.size > 0
      ? await saveUploadedWebImage(webImage, parsed.data.slug, parsed.data.title)
      : await generateWebImage(parsed.data.master_filename, parsed.data.slug, parsed.data.title);

    const created = await registerPrintProduct({
      ...parsed.data,
      installation_tag: null,
      web_image_url: savedImage.urlPath,
    });

    return NextResponse.json(
      {
        ok: true,
        product_id: created.id,
        media_file_id: savedImage.mediaId,
        variants_created: created.product_variants.length,
        ...created,
      },
      { status: 201 },
    );
  } catch (error) {
    if (savedImage) {
      await fs.unlink(savedImage.filePath).catch(() => undefined);
      await supabaseAdmin.from("media_files").delete().eq("id", savedImage.mediaId);
    }

    if (error instanceof Error && error.message === "INVALID_WEB_IMAGE_TYPE") {
      return NextResponse.json({ error: "Only JPEG, PNG, and WEBP web images are supported." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "WEB_IMAGE_TOO_LARGE") {
      return NextResponse.json({ error: "Web image exceeds 8MB limit." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_VARIANT_TEMPLATES") {
      return NextResponse.json({ error: "No active variant templates found." }, { status: 500 });
    }
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: "Stripe is not configured correctly for product registration." },
        { status: 500 },
      );
    }
    if (isDuplicateProductSlugError(error)) {
      return NextResponse.json(
        { error: `A product with slug "${parsed.data.slug}" already exists.` },
        { status: 409 },
      );
    }

    console.error("Admin photo registration failed", error);
    return NextResponse.json({ error: "Failed to register photo." }, { status: 500 });
  }
}
