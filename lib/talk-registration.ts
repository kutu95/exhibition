import { supabaseAdmin } from "./supabase/admin";

export {
  TALK_TITLE,
  TALK_WHEN_LABEL,
  TALK_CONFIRMATION_CAMPAIGN_NAME,
} from "./talk-details";

export const TALK_CAPACITY_CONTENT_KEY = "talk_capacity";
export const DEFAULT_TALK_CAPACITY = 40;

export type TalkList = "confirmed" | "waitlist";

const parseCapacity = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) return null;
  return parsed;
};

/** Seat capacity for free talk tickets. Stored in site_content (editable in admin). */
export const getTalkCapacity = async (): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content_value")
    .eq("content_key", TALK_CAPACITY_CONTENT_KEY)
    .maybeSingle();

  if (error) {
    console.error("Talk capacity lookup failed", error);
  } else {
    const fromDb = parseCapacity(data?.content_value);
    if (fromDb !== null) return fromDb;
  }

  return parseCapacity(process.env.TALK_CAPACITY) ?? DEFAULT_TALK_CAPACITY;
};

export const setTalkCapacity = async (capacity: number): Promise<number> => {
  const next = Math.floor(capacity);
  if (!Number.isFinite(next) || next < 1 || next > 500) {
    throw new Error("Capacity must be between 1 and 500.");
  }

  const value = String(next);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("site_content")
    .select("id")
    .eq("content_key", TALK_CAPACITY_CONTENT_KEY)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ content_value: value, updated_at: new Date().toISOString() })
      .eq("content_key", TALK_CAPACITY_CONTENT_KEY);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("site_content").insert({
      content_key: TALK_CAPACITY_CONTENT_KEY,
      content_value: value,
      content_type: "text",
    });
    if (error) throw error;
  }

  return next;
};

export const normalizeTalkEmail = (email: string): string => email.trim().toLowerCase();
