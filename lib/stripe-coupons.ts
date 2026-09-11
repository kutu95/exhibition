import { stripe } from "./stripe";

const couponIdForPercent = (percent: number): string => `exhibition_pct_${percent}`;

export const stripeCouponIdForPercent = async (percent: number): Promise<string> => {
  const id = couponIdForPercent(percent);
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch (error) {
    const missing =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      (error as { statusCode?: number }).statusCode === 404;
    if (!missing) throw error;
  }

  await stripe.coupons.create({
    id,
    percent_off: percent,
    duration: "once",
    name: `Exhibition ${percent}% off`,
  });
  return id;
};
