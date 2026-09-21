import { seedSchema } from "@/lib/schema";
import { seedOne, SeedError } from "@/lib/seed";
import { getStripe, errorMessage, sameOrigin } from "@/lib/stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.apiKey !== undefined && typeof body.apiKey !== "string")
      throw new Error("Invalid API key.");
    const parsed = seedSchema.safeParse(body);
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues.map((i) => i.message).join(" "),
          retryable: false,
        },
        { status: 400 },
      );
    return Response.json(await seedOne(getStripe(body.apiKey), parsed.data));
  } catch (error) {
    return Response.json(
      {
        error: errorMessage(error),
        retryable: error instanceof SeedError && error.retryable,
        customerId: error instanceof SeedError ? error.customerId : undefined,
      },
      { status: 400 },
    );
  }
}
