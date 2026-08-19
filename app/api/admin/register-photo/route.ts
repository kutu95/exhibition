import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { parseGalleryId, resolveProductGallery } from "../../../../lib/galleries";
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
export const maxDuration = 180;

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
  gallery_id: z.string().uuid().nullable().optional().default(null),
  visibility: z.enum(["public", "vault"]).optional(),
  edition_size: z.number().int().positive(),
  master_filename: z.string().min(1),
  master_pixel_width: z.number().int().positive(),
  master_pixel_height: z.number().int().positive(),
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

const variantFramingField = (
  formData: FormData,
): Record<
  string,
  { fit_mode: "cover_crop" | "custom_size"; crop_offset: number; size_lock: "long_edge" | "width" | "height" | null }
> => {
  const value = formData.get("variant_framing");
  if (typeof value !== "string" || !value.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed).flatMap(([templateId, framing]) => {
      if (!framing || typeof framing !== "object" || Array.isArray(framing)) return [];
      const record = framing as Record<string, unknown>;
      const fitMode = record.fit_mode === "custom_size" ? "custom_size" : "cover_crop";
      const cropOffset = typeof record.crop_offset === "number" ? record.crop_offset : 0;
      const sizeLock =
        record.size_lock === "width" || record.size_lock === "height" || record.size_lock === "long_edge"
          ? record.size_lock
          : null;
      return [[templateId, { fit_mode: fitMode, crop_offset: cropOffset, size_lock: sizeLock }]];
    }),
  );
};

const customSizeVariantsField = (
  formData: FormData,
): Array<{
  paper_type: string;
  print_type?: "fine_art" | "photo" | "canvas" | "metal" | null;
  long_edge_mm: number;
  price_aud?: number | null;
  border_mm?: number;
  print_dpi?: number;
  finish?: string | null;
  edition_size?: number | null;
  tier_label?: string | null;
}> => {
  const value = formData.get("custom_size_variants");
  if (typeof value !== "string" || !value.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const paper = typeof record.paper_type === "string" ? record.paper_type.trim() : "";
    const longEdge = typeof record.long_edge_mm === "number" ? record.long_edge_mm : Number(record.long_edge_mm);
    if (!paper || !Number.isFinite(longEdge) || longEdge <= 0) return [];

    const printType =
      record.print_type === "fine_art" ||
      record.print_type === "photo" ||
      record.print_type === "canvas" ||
      record.print_type === "metal"
        ? record.print_type
        : null;

    return [
      {
        paper_type: paper,
        print_type: printType,
        long_edge_mm: Math.round(longEdge),
        price_aud: typeof record.price_aud === "number" ? Math.round(record.price_aud) : null,
        border_mm: typeof record.border_mm === "number" ? Math.round(record.border_mm) : undefined,
        print_dpi: typeof record.print_dpi === "number" ? Math.round(record.print_dpi) : undefined,
        finish: typeof record.finish === "string" ? record.finish : null,
        edition_size: typeof record.edition_size === "number" ? Math.round(record.edition_size) : null,
        tier_label: typeof record.tier_label === "string" ? record.tier_label : null,
      },
    ];
  });
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
    gallery_id: parseGalleryId(stringField(formData, "gallery_id")),
    visibility: stringField(formData, "visibility") === "vault" ? "vault" : undefined,
    edition_size: Number.parseInt(stringField(formData, "edition_size") ?? "", 10),
    master_filename: stringField(formData, "master_filename"),
    master_pixel_width: Number.parseInt(stringField(formData, "master_pixel_width") ?? "", 10),
    master_pixel_height: Number.parseInt(stringField(formData, "master_pixel_height") ?? "", 10),
    theme_ids: themeIdsField(formData),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid photo registration payload. Title, slug, edition size, master file, and pixel dimensions are required.",
      },
      { status: 400 },
    );
  }

  try {
    const safeFilename = safeMasterFilename(parsed.data.master_filename);
    await fs.access(resolveMasterFilePath(safeFilename));
  } catch (error) {
    return masterFileErrorResponse(error, parsed.data.master_filename);
  }

  let savedImage: SavedWebImage | null = null;
  try {
    const gallery = await resolveProductGallery(parsed.data.gallery_id, parsed.data.visibility);
    if ("error" in gallery) {
      return NextResponse.json({ error: gallery.error }, { status: 400 });
    }

    savedImage = webImage instanceof File && webImage.size > 0
      ? await saveUploadedWebImage(webImage, parsed.data.slug, parsed.data.title)
      : await generateWebImage(parsed.data.master_filename, parsed.data.slug, parsed.data.title);

    const created = await registerPrintProduct({
      ...parsed.data,
      installation_tag: null,
      web_image_url: savedImage.urlPath,
      gallery_id: gallery.gallery_id,
      visibility: gallery.visibility,
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
    if (error instanceof Error && error.message === "MASTER_PIXELS_REQUIRED_FOR_CUSTOM_SIZE") {
      return NextResponse.json(
        { error: "Master TIFF pixel dimensions are required for custom-size variants." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith("NO_SQ_IN_RATE_FOR_PAPER:")) {
      const paper = error.message.replace("NO_SQ_IN_RATE_FOR_PAPER:", "");
      return NextResponse.json(
        { error: `No Pixel Perfect square-inch rate for “${paper}”. Choose another paper or set a price override.` },
        { status: 400 },
      );
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
