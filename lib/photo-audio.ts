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
