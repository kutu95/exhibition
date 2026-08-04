import { supabaseAdmin } from "./supabase/admin";
import {
  seedManagedPapers,
  sortManagedPapers,
  type ManagedPaper,
  type PrintTypeCode,
} from "./print-catalogue";
import { getPrintPricingSettings, type PrintPricingSettings } from "./print-markup";

export const PRINT_PAPERS_CONTENT_KEY = "print_papers";

const PRINT_TYPES: PrintTypeCode[] = ["fine_art", "photo", "canvas", "metal"];

const slugifyPaperId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `paper-${Date.now()}`;

const parsePaper = (raw: unknown, index: number): ManagedPaper | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : null;
  const printType = PRINT_TYPES.includes(record.printType as PrintTypeCode)
    ? (record.printType as PrintTypeCode)
    : null;
  if (!id || !label || !printType) return null;

  let ratePerSqInAud: number | null = null;
  if (record.ratePerSqInAud === null || record.ratePerSqInAud === undefined || record.ratePerSqInAud === "") {
    ratePerSqInAud = null;
  } else {
    const rate = typeof record.ratePerSqInAud === "number" ? record.ratePerSqInAud : Number(record.ratePerSqInAud);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null;
    ratePerSqInAud = Math.round(rate * 1000) / 1000;
  }

  const sortOrder =
    typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
      ? Math.round(record.sortOrder)
      : index;
  const isActive = record.isActive !== false;

  return { id, label, printType, ratePerSqInAud, isActive, sortOrder };
};

const parsePapersJson = (raw: string | null): ManagedPaper[] | null => {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const papers = parsed.flatMap((item, index) => {
      const paper = parsePaper(item, index);
      return paper ? [paper] : [];
    });
    return papers.length > 0 ? sortManagedPapers(papers) : null;
  } catch {
    return null;
  }
};

const upsertPapersContent = async (papers: ManagedPaper[]): Promise<void> => {
  const value = JSON.stringify(sortManagedPapers(papers));
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("site_content")
    .select("id")
    .eq("content_key", PRINT_PAPERS_CONTENT_KEY)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ content_value: value, updated_at: new Date().toISOString() })
      .eq("content_key", PRINT_PAPERS_CONTENT_KEY);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("site_content").insert({
    content_key: PRINT_PAPERS_CONTENT_KEY,
    content_value: value,
    content_type: "json",
  });
  if (error) throw error;
};

/** Load managed papers; seed site_content from catalogue defaults on first read. */
export const getPrintPapers = async (): Promise<ManagedPaper[]> => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content_value")
    .eq("content_key", PRINT_PAPERS_CONTENT_KEY)
    .maybeSingle();

  if (error) {
    console.error("Print papers lookup failed", error);
  } else {
    const fromDb = parsePapersJson(data?.content_value ?? null);
    if (fromDb) return fromDb;
  }

  const seeded = seedManagedPapers();
  try {
    await upsertPapersContent(seeded);
  } catch (seedError) {
    console.error("Failed to seed print papers into site_content", seedError);
  }
  return seeded;
};

export const setPrintPapers = async (input: ManagedPaper[]): Promise<ManagedPaper[]> => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("At least one paper is required.");
  }

  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const papers: ManagedPaper[] = [];

  for (const [index, item] of input.entries()) {
    const paper = parsePaper(item, index);
    if (!paper) {
      throw new Error(`Invalid paper at index ${index}.`);
    }
    const id = paper.id || slugifyPaperId(paper.label);
    const normalizedLabel = paper.label.trim();
    if (seenIds.has(id)) throw new Error(`Duplicate paper id: ${id}`);
    if (seenLabels.has(normalizedLabel.toLowerCase())) {
      throw new Error(`Duplicate paper label: ${normalizedLabel}`);
    }
    seenIds.add(id);
    seenLabels.add(normalizedLabel.toLowerCase());
    papers.push({ ...paper, id, label: normalizedLabel });
  }

  const sorted = sortManagedPapers(papers);
  await upsertPapersContent(sorted);
  return sorted;
};

export type PrintPricingBundle = PrintPricingSettings & {
  papers: ManagedPaper[];
};

export const getPrintPricingBundle = async (): Promise<PrintPricingBundle> => {
  const [settings, papers] = await Promise.all([getPrintPricingSettings(), getPrintPapers()]);
  return { ...settings, papers };
};

export const createBlankPaper = (sortOrder: number): ManagedPaper => ({
  id: `paper-${Date.now()}`,
  label: "",
  printType: "fine_art",
  ratePerSqInAud: 0.181,
  isActive: true,
  sortOrder,
});
