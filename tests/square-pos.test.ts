import { describe, expect, it } from "vitest";

import {
  buildSquarePosAndroidUrl,
  buildSquarePosIosUrl,
  parseSquarePosCallback,
} from "../lib/square-pos";

describe("square POS helpers", () => {
  it("builds android and ios charge urls when app id is set", () => {
    process.env.SQUARE_APPLICATION_ID = "sq0ids-test";
    const input = {
      amountCents: 12500,
      callbackUrl: "https://exhibition.margies.app/admin/on-site/square-return",
      note: "GEOR-TEST",
      clientTransactionId: "draft-1",
    };

    const android = buildSquarePosAndroidUrl(input);
    expect(android).toContain("com.squareup.pos.action.CHARGE");
    expect(android).toContain("TOTAL_AMOUNT=12500");
    expect(android).toContain("CURRENCY_CODE=AUD");

    const ios = buildSquarePosIosUrl(input);
    expect(ios.startsWith("square-commerce-v1://payment/create?data=")).toBe(true);
  });

  it("parses successful callback params", () => {
    const result = parseSquarePosCallback(
      new URLSearchParams({
        "com.squareup.pos.SERVER_TRANSACTION_ID": "sqtxn_123",
        "com.squareup.pos.CLIENT_TRANSACTION_ID": "client_1",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.serverTransactionId).toBe("sqtxn_123");
    }
  });

  it("parses error callback params", () => {
    const result = parseSquarePosCallback(
      new URLSearchParams({
        "com.squareup.pos.ERROR_CODE": "transaction_canceled",
        "com.squareup.pos.ERROR_DESCRIPTION": "User canceled",
      }),
    );
    expect(result.ok).toBe(false);
  });
});
