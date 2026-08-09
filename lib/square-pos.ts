/**
 * Square Point of Sale API — mobile web deep links for card-present charges
 * on a phone/tablet paired with a Square reader.
 *
 * @see https://developer.squareup.com/docs/pos-api/build-mobile-web
 */

export type SquarePosChargeInput = {
  amountCents: number;
  currency?: "AUD";
  note?: string;
  callbackUrl: string;
  clientTransactionId?: string;
};

export function getSquareApplicationId(): string | null {
  const value = process.env.SQUARE_APPLICATION_ID?.trim();
  return value || null;
}

export function isSquarePosConfigured(): boolean {
  return Boolean(getSquareApplicationId());
}

/** Build an Android intent URL that opens Square Point of Sale. */
export function buildSquarePosAndroidUrl(input: SquarePosChargeInput): string {
  const applicationId = getSquareApplicationId();
  if (!applicationId) {
    throw new Error("SQUARE_APPLICATION_ID is not configured.");
  }

  const tenderTypes = [
    "com.squareup.pos.TENDER_CARD",
    "com.squareup.pos.TENDER_CARD_ON_FILE",
    "com.squareup.pos.TENDER_CASH",
    "com.squareup.pos.TENDER_OTHER",
  ].join(",");

  const parts = [
    "intent:#Intent",
    "action=com.squareup.pos.action.CHARGE",
    "package=com.squareup",
    `S.com.squareup.pos.WEB_CALLBACK_URI=${input.callbackUrl}`,
    `S.com.squareup.pos.CLIENT_ID=${applicationId}`,
    "S.com.squareup.pos.API_VERSION=v2.0",
    `i.com.squareup.pos.TOTAL_AMOUNT=${Math.round(input.amountCents)}`,
    `S.com.squareup.pos.CURRENCY_CODE=${input.currency ?? "AUD"}`,
    `S.com.squareup.pos.TENDER_TYPES=${tenderTypes}`,
  ];

  if (input.note) {
    parts.push(`S.com.squareup.pos.NOTE=${encodeURIComponent(input.note.slice(0, 500))}`);
  }
  if (input.clientTransactionId) {
    parts.push(
      `S.com.squareup.pos.REQUEST_METADATA=${encodeURIComponent(input.clientTransactionId)}`,
    );
  }

  parts.push("end");
  return parts.join(";");
}

/** Build an iOS Square Point of Sale deep link. */
export function buildSquarePosIosUrl(input: SquarePosChargeInput): string {
  const applicationId = getSquareApplicationId();
  if (!applicationId) {
    throw new Error("SQUARE_APPLICATION_ID is not configured.");
  }

  const data = {
    amount_money: {
      amount: Math.round(input.amountCents),
      currency_code: input.currency ?? "AUD",
    },
    callback_url: input.callbackUrl,
    client_id: applicationId,
    version: "1.3",
    notes: input.note?.slice(0, 500) ?? undefined,
    options: {
      supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE", "CASH", "OTHER"],
    },
    ...(input.clientTransactionId
      ? { reference_id: input.clientTransactionId }
      : {}),
  };

  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
}

export function pickSquarePosUrl(userAgent: string, input: SquarePosChargeInput): string {
  if (/android/i.test(userAgent)) {
    return buildSquarePosAndroidUrl(input);
  }
  return buildSquarePosIosUrl(input);
}

export type SquarePosCallbackResult =
  | {
      ok: true;
      serverTransactionId: string | null;
      clientTransactionId: string | null;
    }
  | {
      ok: false;
      errorCode: string | null;
      errorDescription: string | null;
    };

/** Parse query params Square POS returns to the callback URL. */
export function parseSquarePosCallback(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): SquarePosCallbackResult {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const value = params[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  // Android extras / iOS query variants
  const errorCode =
    get("com.squareup.pos.ERROR_CODE") ??
    get("error_code") ??
    get("errorCode");
  const errorDescription =
    get("com.squareup.pos.ERROR_DESCRIPTION") ??
    get("error_description") ??
    get("errorDescription");

  if (errorCode) {
    return {
      ok: false,
      errorCode,
      errorDescription,
    };
  }

  const serverTransactionId =
    get("com.squareup.pos.SERVER_TRANSACTION_ID") ??
    get("server_transaction_id") ??
    get("transaction_id") ??
    get("serverTransactionId");
  const clientTransactionId =
    get("com.squareup.pos.CLIENT_TRANSACTION_ID") ??
    get("client_transaction_id") ??
    get("clientTransactionId") ??
    get("com.squareup.pos.REQUEST_METADATA") ??
    get("status");

  // iOS may return data= JSON
  const dataParam = get("data");
  if (dataParam) {
    try {
      const parsed = JSON.parse(dataParam) as Record<string, unknown>;
      if (parsed.error_code || parsed.errorCode) {
        return {
          ok: false,
          errorCode: String(parsed.error_code ?? parsed.errorCode),
          errorDescription: String(parsed.error_description ?? parsed.errorDescription ?? ""),
        };
      }
      return {
        ok: true,
        serverTransactionId: String(
          parsed.transaction_id ?? parsed.server_transaction_id ?? parsed.serverTransactionId ?? "",
        ) || null,
        clientTransactionId: String(
          parsed.client_transaction_id ?? parsed.clientTransactionId ?? "",
        ) || null,
      };
    } catch {
      // fall through
    }
  }

  if (!serverTransactionId && !clientTransactionId) {
    return {
      ok: false,
      errorCode: "missing_transaction",
      errorDescription: "Square did not return a transaction id.",
    };
  }

  return {
    ok: true,
    serverTransactionId,
    clientTransactionId,
  };
}
