import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { fakeCustomer } from "../src/lib/fake";
import {
  configSchema,
  countries,
  profileSchema,
  seedSchema,
  type SeedConfig,
} from "../src/lib/schema";
import { seedOne, SeedError } from "../src/lib/seed";
import { getStripe, errorMessage, sameOrigin } from "../src/lib/stripe";

const config: SeedConfig = {
  nameType: "company",
  domain: "",
  country: "GB",
  addressOverrides: {},
  customerMetadata: [{ key: "team", value: "test" }],
  subscriptionMetadata: [{ key: "source", value: "sandbox" }],
  priceId: "price_test",
  quantity: 1,
  quantityMode: "fixed",
  couponId: "",
  offline: false,
};
const input = {
  runId: "50091123-d9dd-4d0c-a6c3-a713290af934",
  index: 0,
  config,
};
function mockStripe(
  failure?: Error,
  cleanupFailure = false,
  usageType = "licensed",
) {
  const calls: { method: string; data: any; options?: any }[] = [];
  const record =
    (method: string, result: any) => async (data: any, options?: any) => {
      calls.push({ method, data, options });
      return result;
    };
  const mock = {
    prices: {
      retrieve: record("price", {
        id: "price_test",
        active: true,
        livemode: false,
        currency: "gbp",
        recurring: { usage_type: usageType },
        product: { id: "prod_test", active: true },
      }),
    },
    coupons: {
      retrieve: record("coupon", {
        id: "coupon_test",
        valid: true,
        livemode: false,
        currency: "gbp",
        applies_to: { products: ["prod_test"] },
      }),
    },
    paymentMethods: { create: record("payment", { id: "pm_test" }) },
    customers: {
      create: record("customer", { id: "cus_test" }),
      del: async (id: string) => {
        calls.push({ method: "delete", data: id });
        if (cleanupFailure) throw new Error("offline");
        return {};
      },
    },
    subscriptions: {
      create: async (data: any, options: any) => {
        calls.push({ method: "subscription", data, options });
        if (failure) throw failure;
        return { id: "sub_test", status: "active" };
      },
    },
  };
  return { stripe: mock as unknown as Stripe, calls };
}
test("automatic payment attaches a successful test card and keeps metadata separate", async () => {
  const { stripe, calls } = mockStripe();
  const result = await seedOne(stripe, input);
  assert.equal(result.subscriptionId, "sub_test");
  assert.equal(
    calls.find((c) => c.method === "payment")!.data.card.token,
    "tok_visa",
  );
  assert.deepEqual(calls.find((c) => c.method === "customer")!.data.metadata, {
    team: "test",
  });
  const sub = calls.find((c) => c.method === "subscription")!.data;
  assert.equal(sub.collection_method, "charge_automatically");
  assert.equal(sub.payment_behavior, "error_if_incomplete");
  assert.equal(sub.default_payment_method, "pm_test");
  assert.deepEqual(sub.metadata, { source: "sandbox" });
  assert.equal(sub.days_until_due, undefined);
});
test("offline sets customer flag before subscription, Net D, coupon, card-only settings; no card created", async () => {
  const { stripe, calls } = mockStripe();
  await seedOne(stripe, {
    ...input,
    config: {
      ...config,
      offline: true,
      daysUntilDue: 45,
      couponId: "coupon_test",
      customerMetadata: [{ key: "isInvoiced", value: "false" }],
    },
  });
  assert.equal(
    calls.some((c) => c.method === "payment"),
    false,
  );
  const customer = calls.find((c) => c.method === "customer")!.data;
  const sub = calls.find((c) => c.method === "subscription")!.data;
  assert.equal(customer.metadata.isInvoiced, "true");
  assert.equal(sub.metadata.isInvoiced, undefined);
  assert.equal(sub.collection_method, "send_invoice");
  assert.equal(sub.days_until_due, 45);
  assert.deepEqual(sub.payment_settings.payment_method_types, ["card"]);
  assert.deepEqual(sub.discounts, [{ coupon: "coupon_test" }]);
  assert(
    calls.findIndex((c) => c.method === "customer") <
      calls.findIndex((c) => c.method === "subscription"),
  );
});
test("definitive subscription rejection removes the newly created customer", async () => {
  const { stripe, calls } = mockStripe(
    new Stripe.errors.StripeInvalidRequestError({ message: "Invalid price" }),
  );
  await assert.rejects(
    seedOne(stripe, input),
    (e: SeedError) => !e.retryable && e.message.includes("removed"),
  );
  assert.equal(calls.find((c) => c.method === "delete")?.data, "cus_test");
});
test("uncertain network failure never deletes a potentially subscribed customer", async () => {
  const { stripe, calls } = mockStripe(
    new Stripe.errors.StripeConnectionError({ message: "Connection reset" }),
  );
  await assert.rejects(
    seedOne(stripe, input),
    (e: SeedError) => e.retryable && e.customerId === "cus_test",
  );
  assert.equal(
    calls.some((c) => c.method === "delete"),
    false,
  );
});
test("cleanup failures report the orphan customer explicitly", async () => {
  const { stripe } = mockStripe(
    new Stripe.errors.StripeInvalidRequestError({ message: "Invalid price" }),
    true,
  );
  await assert.rejects(
    seedOne(stripe, input),
    (e: SeedError) =>
      !e.retryable &&
      e.message.includes("cleanup failed") &&
      e.customerId === "cus_test",
  );
});
test("retries use identical fake data and idempotency keys, while new indices get different data", async () => {
  const a = mockStripe(),
    b = mockStripe();
  await seedOne(a.stripe, input);
  await seedOne(b.stripe, input);
  assert.deepEqual(a.calls, b.calls);
  assert.notDeepEqual(
    fakeCustomer(config, "row-1"),
    fakeCustomer(config, "row-2"),
  );
});
test("Faker generates all supported country styles, and overrides remain fixed", () => {
  for (const country of Object.keys(countries) as (keyof typeof countries)[]) {
    const profile = fakeCustomer({ ...config, country }, "country-test");
    assert.equal(profile.address.country, country);
    assert(profile.address.line1);
    assert(profile.address.city);
    assert(profile.address.postal_code);
  }
  const profile = fakeCustomer(
    { ...config, addressOverrides: { city: "My city", line2: "" } },
    "x",
  );
  assert.equal(profile.address.city, "My city");
  assert.equal(profile.address.line2, "");
  assert.match(
    fakeCustomer(config, "uk").address.postal_code,
    /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
  );
});
test("domain overrides normalize @; person email matches their generated name", () => {
  const parsed = profileSchema.parse({
    ...config,
    nameType: "person",
    domain: "@whatever.com",
  });
  const profile = fakeCustomer(parsed, "person");
  assert(profile.email.endsWith("@whatever.com"));
  assert(profile.email.startsWith(profile.name.split(" ")[0].toLowerCase()));
  assert.equal(
    profileSchema.safeParse({ ...config, domain: "@bad domain" }).success,
    false,
  );
});
test("metadata, invoice terms and request identifiers are validated", () => {
  assert.equal(
    configSchema.safeParse({ ...config, offline: true }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ ...config, offline: true, daysUntilDue: 0 })
      .success,
    true,
  );
  assert.equal(
    configSchema.safeParse({
      ...config,
      customerMetadata: [
        { key: "a", value: "1" },
        { key: "a", value: "2" },
      ],
    }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      ...config,
      customerMetadata: [{ key: "", value: "orphan" }],
    }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      ...config,
      offline: true,
      daysUntilDue: 10,
      customerMetadata: Array.from({ length: 50 }, (_, i) => ({
        key: `key${i}`,
        value: "v",
      })),
    }).success,
    false,
  );
  assert.equal(seedSchema.safeParse({ ...input, index: -1 }).success, false);
});
test("live credentials are refused and secrets are redacted", () => {
  assert.throws(() => getStripe("sk_live_DO_NOT_USE"), /Live keys are blocked/);
  assert.equal(
    errorMessage(new Error("Invalid key sk_test_secret123")),
    "Invalid key [redacted]",
  );
});

test("origin checks allow Next internal hostname differences and reject foreign origins", () => {
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("http://localhost:43187/api/seed", {
        headers: { origin: "http://127.0.0.1:43187", host: "127.0.0.1:43187" },
      }),
    ),
  );
  assert.throws(
    () =>
      sameOrigin(
        new Request("http://localhost:43187/api/seed", {
          headers: { origin: "https://other.example", host: "127.0.0.1:43187" },
        }),
      ),
    /must come from the app/,
  );
});

test("US addresses keep cities, state codes and five-digit ZIPs together", () => {
  const expected: Record<string, [string, string]> = {
    Seattle: ["WA", "98104"],
    Boston: ["MA", "02201"],
    "New Orleans": ["LA", "70112"],
    Austin: ["TX", "78701"],
    "San Francisco": ["CA", "94102"],
    Chicago: ["IL", "60602"],
  };
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const { address } = fakeCustomer({ ...config, country: "US" }, `us-${i}`);
    assert.match(address.postal_code, /^\d{5}$/);
    assert.deepEqual(
      [address.state, address.postal_code],
      expected[address.city],
    );
    seen.add(address.city);
  }
  assert.equal(seen.size, 6);
  const { address } = fakeCustomer(
    { ...config, country: "US", addressOverrides: { postal_code: "10001" } },
    "override",
  );
  assert.equal(address.postal_code, "10001");
});

test("quantity is sent for both card and invoice subscriptions and omitted for metered prices", async () => {
  for (const offline of [false, true]) {
    const { stripe, calls } = mockStripe();
    await seedOne(stripe, {
      ...input,
      config: {
        ...config,
        quantity: 7,
        offline,
        daysUntilDue: offline ? 30 : undefined,
      },
    });
    assert.equal(
      calls.find((c) => c.method === "subscription")!.data.items[0].quantity,
      7,
    );
  }
  const { stripe, calls } = mockStripe(undefined, false, "metered");
  await seedOne(stripe, { ...input, config: { ...config, quantity: 7 } });
  assert.equal(
    Object.hasOwn(
      calls.find((c) => c.method === "subscription")!.data.items[0],
      "quantity",
    ),
    false,
  );
});

test("quantity defaults for older saved batches and rejects invalid quantities", () => {
  const { quantity: _quantity, ...legacy } = config;
  assert.equal(configSchema.parse(legacy).quantity, 1);
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "5", null]) {
    assert.equal(
      configSchema.safeParse({ ...config, quantity }).success,
      false,
    );
  }
});

test("random quantity varies per subscription, stays in range and remains stable on retry", async () => {
  const quantities = new Set<number>();
  for (let index = 0; index < 25; index++) {
    const request = {
      ...input,
      index,
      config: { ...config, quantityMode: "random" as const },
    };
    const first = mockStripe(),
      retry = mockStripe();
    const a = await seedOne(first.stripe, request);
    const b = await seedOne(retry.stripe, request);
    assert.equal(a.quantity, b.quantity);
    assert(
      a.quantity !== null &&
        Number.isInteger(a.quantity) &&
        a.quantity >= 1 &&
        a.quantity <= 999,
    );
    quantities.add(a.quantity);
    const customer = first.calls.find((c) => c.method === "customer")!;
    const subscription = first.calls.find((c) => c.method === "subscription")!;
    assert.equal(customer.data.payment_method, "pm_test");
    assert.equal(
      customer.data.invoice_settings.default_payment_method,
      "pm_test",
    );
    assert.equal(subscription.data.default_payment_method, "pm_test");
    assert.equal(subscription.data.items[0].quantity, a.quantity);
    assert(
      first.calls.findIndex((c) => c.method === "payment") <
        first.calls.indexOf(customer),
    );
    assert(first.calls.indexOf(customer) < first.calls.indexOf(subscription));
  }
  assert(quantities.size > 1);
});

test("generated metadata is resolved per object before writes and invoice flag overrides generated entries", async () => {
  const generatedConfig: SeedConfig = {
    ...config,
    offline: true,
    daysUntilDue: 30,
    metadataReferenceDate: "2026-09-21T12:00:00.000Z",
    customerMetadata: [
      { key: "id", type: "uuid", value: "" },
      { key: "isInvoiced", type: "boolean", value: "" },
    ],
    subscriptionMetadata: [
      { key: "id", type: "uuid", value: "" },
      { key: "joined", type: "pastDate", value: "" },
    ],
  };
  const first = mockStripe(),
    retry = mockStripe(),
    next = mockStripe();
  await seedOne(first.stripe, { ...input, config: generatedConfig });
  await seedOne(retry.stripe, { ...input, config: generatedConfig });
  await seedOne(next.stripe, { ...input, index: 1, config: generatedConfig });
  assert.deepEqual(first.calls, retry.calls);
  const customer = first.calls.find((c) => c.method === "customer")!.data
    .metadata;
  const subscription = first.calls.find((c) => c.method === "subscription")!
    .data.metadata;
  assert.equal(customer.isInvoiced, "true");
  assert.equal(subscription.isInvoiced, undefined);
  assert.notEqual(customer.id, subscription.id);
  assert.notEqual(
    customer.id,
    next.calls.find((c) => c.method === "customer")!.data.metadata.id,
  );
  assert.match(subscription.joined, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    configSchema.safeParse({
      ...generatedConfig,
      metadataReferenceDate: undefined,
    }).success,
    false,
  );
});

test("test clocks are passed only to customer creation for card and invoice subscriptions", async () => {
  for (const offline of [false, true]) {
    for (const testClockId of [undefined, "", "clock_example123"]) {
      const { stripe, calls } = mockStripe();
      const clockConfig = configSchema.parse({
        ...config,
        offline,
        daysUntilDue: offline ? 30 : undefined,
        testClockId,
      });
      await seedOne(stripe, { ...input, config: clockConfig });
      const customer = calls.find((call) => call.method === "customer")!;
      if (testClockId) assert.equal(customer.data.test_clock, testClockId);
      else assert.equal(Object.hasOwn(customer.data, "test_clock"), false);
      for (const call of calls.filter((call) => call.method !== "customer")) {
        if (typeof call.data === "object" && call.data !== null)
          assert.equal(Object.hasOwn(call.data, "test_clock"), false);
      }
      assert.equal(
        calls.find((call) => call.method === "subscription")!.data.customer,
        "cus_test",
      );
    }
  }
});
test("clock IDs are optional, trimmed and validated before Stripe writes", () => {
  assert.equal(
    configSchema.parse({ ...config, testClockId: "  clock_example123  " })
      .testClockId,
    "clock_example123",
  );
  assert.equal(
    configSchema.parse({ ...config, testClockId: "   " }).testClockId,
    "",
  );
  for (const testClockId of ["clock_", "cus_wrong", "clock_has spaces", 123]) {
    assert.equal(
      configSchema.safeParse({ ...config, testClockId }).success,
      false,
    );
  }
});
