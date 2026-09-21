import { randomUUID } from "node:crypto";
import { profileSchema } from "@/lib/schema";
import { fakeCustomer } from "@/lib/fake";
import { errorMessage, sameOrigin } from "@/lib/stripe";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const config = profileSchema.parse(await request.json());
    return Response.json(fakeCustomer(config, randomUUID()));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
