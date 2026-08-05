import { PRINT_EDITORIAL, type PlaceKey } from "./print-editorial";

export type RelatedPrintCandidate = {
  slug: string;
  title: string;
  location_tag: string | null;
  photo_type_tag: string | null;
  created_at: string;
  master_filename: string | null;
  theme_ids: string[];
  image_url: string | null;
};

export type RelatedPrint = {
  slug: string;
  title: string;
  imageUrl: string | null;
};

const WEIGHT = {
  location: 5,
  sharedTheme: 4,
  extraSharedTheme: 1,
  photoType: 4,
  dateSameDay: 5,
  dateWithinWeek: 3,
  dateWithinMonth: 2,
  dateWithinQuarter: 1,
  editorialPlace: 3,
} as const;

/** Ignore near-zero matches so the strip stays meaningful. */
export const RELATED_PRINT_MIN_SCORE = 3;
export const RELATED_PRINT_LIMIT = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pull YYYYMMDD from master filenames / slugs like `20260518_Dumbarton…` or `20190426-isaac…`. */
export const parsePhotoDateMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : null;
};

export const resolvePhotoDateMs = (candidate: {
  master_filename: string | null;
  slug: string;
  created_at: string;
}): number => {
  return (
    parsePhotoDateMs(candidate.master_filename) ??
    parsePhotoDateMs(candidate.slug) ??
    Date.parse(candidate.created_at)
  );
};

const editorialPlaceForSlug = (slug: string): PlaceKey | null => PRINT_EDITORIAL[slug]?.place ?? null;

export const scoreRelatedPrint = (
  source: RelatedPrintCandidate,
  candidate: RelatedPrintCandidate,
): number => {
  if (source.slug === candidate.slug) return 0;

  let score = 0;

  if (
    source.location_tag &&
    candidate.location_tag &&
    source.location_tag === candidate.location_tag
  ) {
    score += WEIGHT.location;
  }

  if (
    source.photo_type_tag &&
    candidate.photo_type_tag &&
    source.photo_type_tag === candidate.photo_type_tag
  ) {
    score += WEIGHT.photoType;
  }

  const sharedThemes = source.theme_ids.filter((id) => candidate.theme_ids.includes(id));
  if (sharedThemes.length > 0) {
    score += WEIGHT.sharedTheme + Math.max(0, sharedThemes.length - 1) * WEIGHT.extraSharedTheme;
  }

  const sourceDate = resolvePhotoDateMs(source);
  const candidateDate = resolvePhotoDateMs(candidate);
  if (Number.isFinite(sourceDate) && Number.isFinite(candidateDate)) {
    const daysApart = Math.abs(sourceDate - candidateDate) / DAY_MS;
    if (daysApart < 1) score += WEIGHT.dateSameDay;
    else if (daysApart <= 7) score += WEIGHT.dateWithinWeek;
    else if (daysApart <= 31) score += WEIGHT.dateWithinMonth;
    else if (daysApart <= 92) score += WEIGHT.dateWithinQuarter;
  }

  const sourcePlace = editorialPlaceForSlug(source.slug);
  const candidatePlace = editorialPlaceForSlug(candidate.slug);
  if (sourcePlace && candidatePlace && sourcePlace === candidatePlace) {
    score += WEIGHT.editorialPlace;
  }

  return score;
};

export const pickRelatedPrints = (
  source: RelatedPrintCandidate,
  candidates: RelatedPrintCandidate[],
  options: { limit?: number; minScore?: number } = {},
): RelatedPrint[] => {
  const limit = options.limit ?? RELATED_PRINT_LIMIT;
  const minScore = options.minScore ?? RELATED_PRINT_MIN_SCORE;

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreRelatedPrint(source, candidate),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.title.localeCompare(b.candidate.title);
    })
    .slice(0, limit)
    .map(({ candidate }) => ({
      slug: candidate.slug,
      title: candidate.title,
      imageUrl: candidate.image_url,
    }));
};
