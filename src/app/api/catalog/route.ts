import { getStripe, errorMessage, sameOrigin } from "@/lib/stripe";
import type { Catalog } from "@/lib/schema";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.apiKey !== undefined && typeof body.apiKey !== "string")
      throw new Error("Invalid API key.");
    const stripe = getStripe(body.apiKey);
    const catalog: Catalog = { products: [], prices: [], coupons: [] };
    await Promise.all([
      (async () => {
        for await (const p of stripe.products.list({
          active: true,
          limit: 100,
        })) {
          if (p.livemode) throw new Error("Live data is not allowed.");
          catalog.products.push({ id: p.id, name: p.name });
        }
      })(),
      (async () => {
        for await (const p of stripe.prices.list({
          active: true,
          type: "recurring",
          limit: 100,
        })) {
          if (p.livemode) throw new Error("Live data is not allowed.");
          const digits =
            new Intl.NumberFormat("en", {
              style: "currency",
              currency: p.currency,
            }).resolvedOptions().maximumFractionDigits ?? 2;
          const amount =
            p.unit_amount === null
              ? "Tiered / usage pricing"
              : new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: p.currency,
                }).format(p.unit_amount / 10 ** digits);
          catalog.prices.push({
            id: p.id,
            productId: typeof p.product === "string" ? p.product : p.product.id,
            currency: p.currency,
            label: `${p.nickname ? p.nickname + " · " : ""}${amount} / ${p.recurring!.interval_count > 1 ? p.recurring!.interval_count + " " : ""}${p.recurring!.interval} · ${p.id}`,
          });
        }
      })(),
      (async () => {
        for await (const c of stripe.coupons.list({ limit: 100 })) {
          if (c.valid && !c.livemode)
            catalog.coupons.push({
              id: c.id,
              label: `${c.name || c.id}${c.percent_off !== null ? ` · ${c.percent_off}% off` : ""}`,
              products: c.applies_to?.products || [],
              currency: c.currency,
            });
        }
      })(),
    ]);
    catalog.products.sort((a, b) => a.name.localeCompare(b.name));
    return Response.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
