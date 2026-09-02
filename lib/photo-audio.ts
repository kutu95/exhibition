import { slugify } from "./utils/slugify";

export const AUDIO_EXTENSIONS = ["mp3", "m4a", "ogg", "wav", "webm"] as const;
export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number];

export const AUDIO_URL_PATTERN =
  /^\/audio\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(mp3|m4a|ogg|wav|webm)$/i;

const AUDIO_MIME_TO_EXTENSION: Record<string, AudioExtension> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};

const isAudioExtension = (value: string): value is AudioExtension =>
  (AUDIO_EXTENSIONS as readonly string[]).includes(value);

export type PhotoAudioFields = {
  audio_url: string | null;
  audio_duration: string | null;
  audio_transcript: string | null;
};

export const emptyAudioFields = (): PhotoAudioFields => ({
  audio_url: null,
  audio_duration: null,
  audio_transcript: null,
});

export const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export const isValidAudioUrl = (value: string): boolean => AUDIO_URL_PATTERN.test(value.trim());

export const parseAudioDuration = (value: string | null | undefined): number | null => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatAudioClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

export const normalizeAudioFields = (
  input: Partial<PhotoAudioFields> | null | undefined,
): { ok: true; value: PhotoAudioFields } | { ok: false; error: string } => {
  const audioUrl = normalizeOptionalText(input?.audio_url);
  if (audioUrl && !isValidAudioUrl(audioUrl)) {
    return { ok: false, error: "Audio URL must be a path like /audio/photo-name.mp3." };
  }

  const audioDuration = normalizeOptionalText(input?.audio_duration);
  if (audioDuration && parseAudioDuration(audioDuration) === null) {
    return { ok: false, error: "Audio duration must look like 0:47." };
  }

  return {
    ok: true,
    value: {
      audio_url: audioUrl,
      audio_duration: audioDuration,
      audio_transcript: normalizeOptionalText(input?.audio_transcript),
    },
  };
};

export const hasPhotoAudioStory = <T extends { audio_url?: string | null }>(
  product: T | null | undefined,
): product is T & { audio_url: string } =>
  Boolean(product?.audio_url && isValidAudioUrl(product.audio_url));

/** Stable filename stem so the recording can be matched back to the product. */
export const audioStemFromProduct = (slug?: string | null, title?: string | null): string | null => {
  const fromSlug = slugify(slug ?? "");
  if (fromSlug) return fromSlug;
  const fromTitle = slugify(title ?? "");
  return fromTitle || null;
};

export const extensionForAudioUpload = (file: { name: string; type: string }): AudioExtension | null => {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (isAudioExtension(fromName)) return fromName;
  const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  return AUDIO_MIME_TO_EXTENSION[mime] ?? null;
};

export const productAudioUrl = (stem: string, extension: AudioExtension): string =>
  `/audio/${stem}.${extension}`;

export type ExistingAudioProduct = {
  id: string;
  title: string;
  slug: string;
};

export type ExistingAudioStory = {
  audio_url: string;
  audio_duration: string | null;
  audio_transcript: string | null;
  products: ExistingAudioProduct[];
};

export const audioFilenameFromUrl = (url: string): string => {
  const trimmed = url.trim();
  const filename = trimmed.split("/").pop();
  return filename && filename.length > 0 ? filename : trimmed;
};

type AudioStorySource = {
  id: string;
  title: string;
  slug: string;
  audio_url: string | null;
  audio_duration?: string | null;
  audio_transcript?: string | null;
};

const preferTranscript = (current: string | null, next: string | null): string | null => {
  const incoming = next?.trim() || null;
  if (!incoming) return current;
  if (!current || incoming.length > current.length) return incoming;
  return current;
};

/** One row per shared recording, with the photographs already using it. */
export const groupExistingAudioStories = (products: AudioStorySource[]): ExistingAudioStory[] => {
  const byUrl = new Map<string, ExistingAudioStory>();

  for (const product of products) {
    const audioUrl = product.audio_url?.trim() ?? "";
    if (!isValidAudioUrl(audioUrl)) continue;

    const duration = normalizeOptionalText(product.audio_duration);
    const transcript = normalizeOptionalText(product.audio_transcript);
    const entry = { id: product.id, title: product.title, slug: product.slug };
    const existing = byUrl.get(audioUrl);

    if (!existing) {
      byUrl.set(audioUrl, {
        audio_url: audioUrl,
        audio_duration: duration,
        audio_transcript: transcript,
        products: [entry],
      });
      continue;
    }

    if (!existing.products.some((item) => item.id === product.id)) {
      existing.products.push(entry);
    }
    if (!existing.audio_duration && duration) existing.audio_duration = duration;
    existing.audio_transcript = preferTranscript(existing.audio_transcript, transcript);
  }

  for (const story of byUrl.values()) {
    story.products.sort((a, b) => a.title.localeCompare(b.title, "en"));
  }

  return [...byUrl.values()].sort((a, b) => {
    const left = a.products[0]?.title ?? a.audio_url;
    const right = b.products[0]?.title ?? b.audio_url;
    return left.localeCompare(right, "en");
  });
};

export const filterExistingAudioStories = (
  stories: ExistingAudioStory[],
  query: string,
): ExistingAudioStory[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return stories;
  return stories.filter((story) => {
    if (audioFilenameFromUrl(story.audio_url).toLowerCase().includes(needle)) return true;
    if (story.audio_url.toLowerCase().includes(needle)) return true;
    return story.products.some(
      (product) =>
        product.title.toLowerCase().includes(needle) || product.slug.toLowerCase().includes(needle),
    );
  });
};
