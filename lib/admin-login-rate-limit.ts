type AttemptBucket = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

const buckets = new Map<string, AttemptBucket>();

/** Failed attempts allowed in the window before lockout. */
export const ADMIN_LOGIN_MAX_FAILURES = 5;
/** Sliding window for counting failures (ms). */
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** How long an IP stays locked after exceeding the failure limit (ms). */
export const ADMIN_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const pruneExpired = (now: number) => {
  for (const [key, bucket] of buckets) {
    const windowExpired = now - bucket.windowStartedAt > ADMIN_LOGIN_WINDOW_MS;
    const lockExpired = !bucket.lockedUntil || bucket.lockedUntil <= now;
    if (windowExpired && lockExpired) {
      buckets.delete(key);
    }
  }
};

export const getAdminLoginClientIp = (request: Request): string => {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
};

export type AdminLoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export const checkAdminLoginRateLimit = (
  ip: string,
  now = Date.now(),
): AdminLoginRateLimitResult => {
  pruneExpired(now);
  const bucket = buckets.get(ip);
  if (!bucket?.lockedUntil || bucket.lockedUntil <= now) {
    if (bucket?.lockedUntil && bucket.lockedUntil <= now) {
      buckets.delete(ip);
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)),
  };
};

export const recordAdminLoginFailure = (ip: string, now = Date.now()): AdminLoginRateLimitResult => {
  pruneExpired(now);
  const existing = buckets.get(ip);

  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.lockedUntil - now) / 1000)),
    };
  }

  if (!existing || now - existing.windowStartedAt > ADMIN_LOGIN_WINDOW_MS) {
    buckets.set(ip, {
      failures: 1,
      windowStartedAt: now,
      lockedUntil: null,
    });
    return { allowed: true };
  }

  const failures = existing.failures + 1;
  if (failures >= ADMIN_LOGIN_MAX_FAILURES) {
    const lockedUntil = now + ADMIN_LOGIN_LOCKOUT_MS;
    buckets.set(ip, {
      failures,
      windowStartedAt: existing.windowStartedAt,
      lockedUntil,
    });
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(ADMIN_LOGIN_LOCKOUT_MS / 1000),
    };
  }

  buckets.set(ip, {
    failures,
    windowStartedAt: existing.windowStartedAt,
    lockedUntil: null,
  });
  return { allowed: true };
};

export const clearAdminLoginFailures = (ip: string) => {
  buckets.delete(ip);
};

/** Test helper — clears all tracked IPs. */
export const resetAdminLoginRateLimitForTests = () => {
  buckets.clear();
};
