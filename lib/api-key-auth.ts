import { timingSafeEqual } from "crypto";

const getAcceptedApiKeys = (): string[] =>
  [
    process.env.EXHIBITION_API_KEY,
    process.env.FULFILMENT_API_KEY,
    process.env.API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((key): key is string => Boolean(key));

const safeEquals = (candidate: string, expected: string): boolean => {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);

  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
};

export const verifyBearerApiKey = (request: Request): boolean => {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return false;
  }

  return getAcceptedApiKeys().some((apiKey) => safeEquals(token, apiKey));
};
