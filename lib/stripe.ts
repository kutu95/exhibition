import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const missingEnvMessage = "Missing STRIPE_SECRET_KEY";

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      typescript: true,
    })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(missingEnvMessage);
        },
      },
    ) as Stripe);
