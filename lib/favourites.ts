export const FAVOURITES_STORAGE_KEY = "exhibition-favourites";
export const FAVOURITES_CHANGED_EVENT = "exhibition-favourites-changed";
export const VISITOR_ID_STORAGE_KEY = "exhibition-visitor-id";

const canUseStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const readFavourites = (): string[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
  } catch {
    return [];
  }
};

const writeFavourites = (ids: string[]): string[] => {
  if (!canUseStorage()) return ids;
  const unique = [...new Set(ids)];
  window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event(FAVOURITES_CHANGED_EVENT));
  return unique;
};

export const isFavourite = (productId: string): boolean => readFavourites().includes(productId);

export const addFavourite = (productId: string): string[] => {
  const current = readFavourites();
  if (current.includes(productId)) return current;
  return writeFavourites([...current, productId]);
};

export const removeFavourite = (productId: string): string[] =>
  writeFavourites(readFavourites().filter((id) => id !== productId));

export const toggleFavourite = (productId: string): { ids: string[]; added: boolean } => {
  const current = readFavourites();
  if (current.includes(productId)) {
    return { ids: writeFavourites(current.filter((id) => id !== productId)), added: false };
  }
  return { ids: writeFavourites([...current, productId]), added: true };
};

export const getOrCreateVisitorId = (): string => {
  if (!canUseStorage()) return "";
  const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY)?.trim() ?? "";
  if (existing && isUuid(existing)) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
  return created;
};
