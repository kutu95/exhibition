export const TALK_TITLE = "Marcia van Zeller — The Truth About the Georgette";
export const TALK_WHEN_LABEL = "Sunday 20 September · 11am–12pm";

/** Soft capacity for free tickets. Override with TALK_CAPACITY env (integer). */
export const getTalkCapacity = (): number => {
  const raw = process.env.TALK_CAPACITY?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 80;
};

export const normalizeTalkEmail = (email: string): string => email.trim().toLowerCase();
