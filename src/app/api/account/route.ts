import { accountInfo } from "@/lib/account-info";
import {
  errorMessage,
  getStripeForAccountLookup,
  sameOrigin,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.apiKey !== undefined && typeof body.apiKey !== "string")
      throw new Error("Invalid API key.");
    const { stripe, mode } = getStripeForAccountLookup(body.apiKey);
    try {
      const account = accountInfo(await stripe.accounts.retrieveCurrent());
      return Response.json(
        { mode, account },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      return Response.json(
        { mode, account: null, accountError: errorMessage(error) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
