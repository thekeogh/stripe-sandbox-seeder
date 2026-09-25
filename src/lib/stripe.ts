import Stripe from "stripe";
import { stripeKeyMode } from "./stripe-key-mode";
export function getStripeForAccountLookup(providedKey?: string) {
  const key = (providedKey || process.env.STRIPE_SECRET_KEY)?.trim();
  if (!key || key === "sk_test_replace_me")
    throw new Error("Enter your Stripe secret key in the connection section.");
  const mode = stripeKeyMode(key);
  if (mode === "unknown") throw new Error("Enter a valid Stripe secret key.");
  return {
    stripe: new Stripe(key, { maxNetworkRetries: 2, timeout: 30000 }),
    mode,
  };
}
export function getStripe(providedKey?: string) {
  const key = (providedKey || process.env.STRIPE_SECRET_KEY)?.trim();
  if (!key || key === "sk_test_replace_me")
    throw new Error("Enter your sandbox secret key in the connection section.");
  if (stripeKeyMode(key) !== "test")
    throw new Error(
      "Only Stripe test / sandbox secret keys are allowed. Live keys are blocked.",
    );
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 30000 });
}
export function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Something went wrong."
  ).replace(/(?:sk|rk)_(?:test|live)_[^\s\"'<>]+/g, "[redacted]");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host"))
    throw new Error("This request must come from the app.");
}
