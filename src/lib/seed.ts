import Stripe from "stripe";
import type { z } from "zod";
import { seedSchema } from "./schema";
import { fakeCustomer, fakeQuantity } from "./fake";
import { generateMetadata } from "./generate-metadata";
import { errorMessage } from "./stripe";

export class SeedError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public customerId?: string,
  ) {
    super(message);
  }
}

export async function seedOne(
  stripe: Stripe,
  input: z.infer<typeof seedSchema>,
) {
  const { config, runId, index } = input;
  const key = `sandbox-seeder:${runId}:${index}`;
  const options = (step: string) => ({ idempotencyKey: `${key}:${step}` });
  const price = await stripe.prices.retrieve(config.priceId, {
    expand: ["product"],
  });
  const product = price.product as Stripe.Product;
  if (
    price.livemode ||
    !price.active ||
    !price.recurring ||
    product.deleted ||
    !product.active
  )
    throw new SeedError(
      "Choose an active recurring price from an active sandbox product.",
      false,
    );
  if (config.couponId) {
    const coupon = await stripe.coupons.retrieve(config.couponId);
    if (!coupon.valid || coupon.livemode)
      throw new SeedError("This coupon is no longer valid.", false);
    if (
      coupon.applies_to?.products &&
      !coupon.applies_to.products.includes(product.id)
    )
      throw new SeedError(
        "This coupon does not apply to the selected product.",
        false,
      );
    if (coupon.currency && coupon.currency !== price.currency)
      throw new SeedError("Coupon and price currencies must match.", false);
  }
  const profile = fakeCustomer(config, key);
  const customerMetadata = generateMetadata(
    config.customerMetadata,
    `${key}:customer`,
    config.country,
    config.metadataReferenceDate,
  );
  const subscriptionMetadata = generateMetadata(
    config.subscriptionMetadata,
    `${key}:subscription`,
    config.country,
    config.metadataReferenceDate,
  );
  let customerId: string | undefined;
  try {
    const paymentMethod = config.offline
      ? undefined
      : await stripe.paymentMethods.create(
          { type: "card", card: { token: "tok_visa" } },
          options("payment-method"),
        );
    const customer = await stripe.customers.create(
      {
        ...profile,
        metadata: {
          ...customerMetadata,
          ...(config.offline ? { isInvoiced: "true" } : {}),
        },
        ...(paymentMethod
          ? {
              payment_method: paymentMethod.id,
              invoice_settings: { default_payment_method: paymentMethod.id },
            }
          : {}),
      },
      options("customer"),
    );
    customerId = customer.id;
    const quantity =
      price.recurring.usage_type === "metered"
        ? null
        : config.quantityMode === "random"
          ? fakeQuantity(key)
          : config.quantity;
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [
          {
            price: price.id,
            ...(quantity === null ? {} : { quantity }),
          },
        ],
        metadata: subscriptionMetadata,
        ...(config.couponId
          ? { discounts: [{ coupon: config.couponId }] }
          : {}),
        payment_settings: { payment_method_types: ["card"] },
        ...(config.offline
          ? {
              collection_method: "send_invoice",
              days_until_due: config.daysUntilDue,
            }
          : {
              collection_method: "charge_automatically",
              payment_behavior: "error_if_incomplete",
              default_payment_method: paymentMethod!.id,
            }),
      },
      options("subscription"),
    );
    return {
      customerId,
      subscriptionId: subscription.id,
      quantity,
      name: profile.name,
      email: profile.email,
      status: subscription.status,
    };
  } catch (error) {
    // Only compensate definitive rejection. A network error may have committed a subscription.
    const definitive =
      error instanceof Stripe.errors.StripeInvalidRequestError ||
      error instanceof Stripe.errors.StripeCardError;
    if (definitive && customerId) {
      try {
        await stripe.customers.del(customerId);
      } catch {
        throw new SeedError(
          `${errorMessage(error)} Customer cleanup failed; inspect ${customerId} in Stripe before starting again.`,
          false,
          customerId,
        );
      }
      throw new SeedError(
        `${errorMessage(error)} The customer created for this failed subscription was removed.`,
        false,
      );
    }
    throw new SeedError(
      `${errorMessage(error)}${customerId ? ` Customer: ${customerId}.` : ""}`,
      !definitive,
      customerId,
    );
  }
}
