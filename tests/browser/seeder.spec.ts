import { expect, test } from "@playwright/test";
const catalog = {
  products: [{ id: "prod_demo", name: "Starter" }],
  prices: [
    {
      id: "price_demo",
      productId: "prod_demo",
      currency: "gbp",
      label: "£20.00 / month",
      usageType: "licensed",
    },
  ],
  coupons: [
    {
      id: "coupon_demo",
      label: "Welcome · 20% off",
      products: [],
      currency: null,
    },
  ],
};

test("connection, every form preference, metadata keyboard controls, reload, and invoice batch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const payloads: any[] = [];
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.route("**/api/seed", (route) => {
    const body = route.request().postDataJSON();
    payloads.push(body);
    return route.fulfill({
      json: {
        customerId: `cus_${body.index}`,
        subscriptionId: `sub_${body.index}`,
        name: "Example Company",
        email: "sample@whatever.com",
        status: "active",
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByLabel("Address line 1", { exact: true }),
  ).not.toHaveValue("");
  await page.getByLabel("Secret API key").fill("sk_test_browser_fixture");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("●  Stripe connected")).toBeVisible();
  await page.getByLabel("Number of customers").fill("2");
  await page.getByLabel("Test Clock ID").fill("clock_example123");
  await expect(
    page.getByRole("button", { name: "Random · 1–999" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Fixed quantity" }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page.getByRole("button", { name: "First & last name" }).click();
  await page.getByLabel("Email domain").fill("@whatever.com");
  await page
    .getByLabel("Customer metadata key 1", { exact: true })
    .fill("orgId");
  await page
    .getByLabel("Customer metadata value 1", { exact: true })
    .fill("dummy-org");
  await page
    .getByLabel("Customer metadata value 1", { exact: true })
    .press("Enter");
  await expect(
    page.getByLabel("Customer metadata key 2", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Customer metadata key 2", { exact: true })
    .fill("environment");
  await page
    .getByLabel("Customer metadata value 2", { exact: true })
    .fill("test");
  await page
    .getByRole("button", { name: "Add Customer metadata row after 2" })
    .click();
  await page
    .getByRole("button", { name: "Remove Customer metadata row 3" })
    .click();
  await page
    .getByLabel("Address line 1", { exact: true })
    .fill("12 Test Street");
  await page.getByRole("combobox", { name: "Product", exact: true }).click();
  await page.getByRole("option", { name: "Starter", exact: true }).click();
  await page.getByRole("combobox", { name: "Coupon", exact: true }).click();
  await page.getByRole("option", { name: "Welcome · 20% off" }).click();
  await page
    .getByLabel("Subscription metadata key 1", { exact: true })
    .fill("source");
  await page
    .getByLabel("Subscription metadata value 1", { exact: true })
    .fill("testing");
  await page.getByLabel("Offline/Invoice payment method").check();
  await page.getByLabel("Payment due in (Net D)").fill("45");
  await page.reload();
  await expect(page.getByText("●  Stripe connected")).toBeVisible();
  await expect(page.getByLabel("Secret API key")).toHaveValue(
    "sk_test_browser_fixture",
  );
  await expect(page.getByLabel("Number of customers")).toHaveValue("2");
  await expect(page.getByLabel("Test Clock ID")).toHaveValue(
    "clock_example123",
  );
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("5");
  await expect(
    page.getByRole("button", { name: "First & last name" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Email domain")).toHaveValue("@whatever.com");
  await expect(page.getByLabel("Address line 1", { exact: true })).toHaveValue(
    "12 Test Street",
  );
  await expect(
    page.getByLabel("Customer metadata value 2", { exact: true }),
  ).toHaveValue("test");
  await expect(
    page.getByLabel("Subscription metadata value 1", { exact: true }),
  ).toHaveValue("testing");
  await expect(page.getByLabel("Payment due in (Net D)")).toHaveValue("45");
  await expect(
    page.getByRole("combobox", { name: "Product", exact: true }),
  ).toHaveText("Starter");
  await expect(
    page.getByRole("combobox", { name: "Coupon", exact: true }),
  ).toHaveText("Welcome · 20% off");
  await page
    .getByRole("button", { name: "Seed customers", exact: true })
    .click();
  await expect(page.getByText("Your sandbox is ready")).toBeVisible();
  const progress = page.getByRole("region", { name: "Batch progress" });
  await expect(progress).toHaveCSS("position", "fixed");
  await expect(
    progress.getByRole("button", { name: "Expand batch details" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect((await progress.boundingBox())!.height).toBeLessThan(70);
  await expect(progress.getByRole("link", { name: "Customer ↗" })).toHaveCount(
    0,
  );
  await progress.getByRole("button", { name: "Expand batch details" }).click();
  await expect(progress.getByRole("link", { name: "Customer ↗" })).toHaveCount(
    2,
  );
  await expect(
    progress.getByRole("button", { name: "Collapse batch details" }),
  ).toHaveAttribute("aria-expanded", "true");
  await progress
    .getByRole("button", { name: "Collapse batch details" })
    .click();
  await expect(progress.getByRole("link", { name: "Customer ↗" })).toHaveCount(
    0,
  );

  expect(payloads).toHaveLength(2);
  expect(payloads[0].config).toMatchObject({
    offline: true,
    daysUntilDue: 45,
    quantity: 5,
    quantityMode: "fixed",
    testClockId: "clock_example123",
    domain: "whatever.com",
    couponId: "coupon_demo",
    addressOverrides: { line1: "12 Test Street" },
  });
  expect(payloads[0].runId).toBe(payloads[1].runId);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    animations: "disabled",
    path: "test-results/seeder-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    animations: "disabled",
    path: "test-results/seeder-mobile.png",
    fullPage: true,
  });
});

test("live keys are rejected, automatic batch validates count, interrupted request resumes safely, key can be forgotten", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Secret API key").fill("sk_live_fixture");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Only Stripe test / sandbox secret keys are allowed.",
    }),
  ).toBeVisible();
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.getByLabel("Secret API key").fill("sk_test_browser_fixture");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("combobox", { name: "Product", exact: true }).click();
  await page.getByRole("option", { name: "Starter", exact: true }).click();
  await page.getByLabel("Number of customers").fill("0");
  await page
    .getByRole("button", { name: "Seed customers", exact: true })
    .click();
  await expect(
    page.getByText("Enter a whole number of customers greater than zero."),
  ).toBeVisible();
  await page.getByLabel("Number of customers").fill("1");
  const payloads: any[] = [];
  await page.route("**/api/seed", (route) => {
    payloads.push(route.request().postDataJSON());
    return payloads.length === 1
      ? route.abort()
      : route.fulfill({
          json: {
            customerId: "cus_a",
            subscriptionId: "sub_a",
            name: "Test Company",
            email: "test@example.com",
            status: "active",
          },
        });
  });
  await page
    .getByRole("button", { name: "Seed customers", exact: true })
    .click();
  await expect(page.getByText(/connection was interrupted/)).toBeVisible();
  await page.getByRole("button", { name: "Resume batch" }).click();
  await expect(page.getByText("Your sandbox is ready")).toBeVisible();
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[0].config.offline).toBe(false);
  expect(payloads[0].config.quantityMode).toBe("random");
  await page.getByLabel(/Remember API key/).uncheck();
  await page.reload();
  await expect(page.getByLabel("Secret API key")).toHaveValue("");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stripe-seeder-settings-v1")!),
  );
  expect(saved.apiKey).toBe("");
  expect(saved.priceId).toBe("price_demo");
});

test("Faker metadata controls persist and submit alongside custom text", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: catalog }),
  );
  let submitted: any;
  await page.route("**/api/seed", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      json: {
        customerId: "cus_meta",
        subscriptionId: "sub_meta",
        name: "Test",
        email: "test@example.com",
        status: "active",
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Secret API key").fill("sk_test_browser_fixture");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByLabel("Number of customers").fill("1");
  await page.getByRole("combobox", { name: "Product", exact: true }).click();
  await page.getByRole("option", { name: "Starter", exact: true }).click();
  const selectType = async (label: string, option: string) => {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await expect(
    page.getByRole("combobox", { name: "Customer metadata type 1" }),
  ).toHaveText("Custom text");
  await page
    .getByLabel("Customer metadata key 1", { exact: true })
    .fill("externalId");
  await page
    .getByLabel("Customer metadata value 1", { exact: true })
    .fill("remember-me");
  await selectType("Customer metadata type 1", "UUID");
  await expect(
    page.getByLabel("Customer metadata value 1", { exact: true }),
  ).toHaveCount(0);
  await selectType("Customer metadata type 1", "Custom text");
  await expect(
    page.getByLabel("Customer metadata value 1", { exact: true }),
  ).toHaveValue("remember-me");
  await selectType("Customer metadata type 1", "UUID");
  // Enter selects an option without adding a row.
  await page
    .getByRole("combobox", { name: "Customer metadata type 1" })
    .press("Enter");
  await page.getByRole("option", { name: "UUID", exact: true }).press("Enter");
  await expect(
    page.getByLabel("Customer metadata key 2", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Customer metadata key 1", { exact: true })
    .press("Enter");
  await expect(
    page.getByLabel("Customer metadata key 2", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Customer metadata key 2", { exact: true })
    .fill("score");
  await selectType("Customer metadata type 2", "Decimal number");
  await page
    .getByLabel("Customer metadata min 2", { exact: true })
    .fill("1.25");
  await page
    .getByLabel("Customer metadata max 2", { exact: true })
    .fill("9.75");
  await page
    .getByRole("button", { name: "Add Customer metadata row after 2" })
    .click();
  await page
    .getByLabel("Customer metadata key 3", { exact: true })
    .fill("source");
  await page
    .getByLabel("Customer metadata value 3", { exact: true })
    .fill("constant");
  await page
    .getByLabel("Subscription metadata key 1", { exact: true })
    .fill("code");
  await selectType("Subscription metadata type 1", "Short alphanumeric ID");
  await page
    .getByLabel("Subscription metadata length 1", { exact: true })
    .fill("8");
  await page
    .getByRole("button", { name: "Add Subscription metadata row after 1" })
    .click();
  await page
    .getByLabel("Subscription metadata key 2", { exact: true })
    .fill("date");
  await selectType("Subscription metadata type 2", "Future date");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Customer metadata type 1" }),
  ).toHaveText("UUID");
  await expect(
    page.getByLabel("Customer metadata min 2", { exact: true }),
  ).toHaveValue("1.25");
  await expect(
    page.getByLabel("Customer metadata max 2", { exact: true }),
  ).toHaveValue("9.75");
  await expect(
    page.getByLabel("Subscription metadata length 1", { exact: true }),
  ).toHaveValue("8");
  await expect(
    page.getByRole("combobox", { name: "Subscription metadata type 2" }),
  ).toHaveText("Future date");
  await page
    .getByRole("button", { name: "Seed customers", exact: true })
    .click();
  await expect(page.getByText("Your sandbox is ready")).toBeVisible();
  expect(submitted.config.customerMetadata).toEqual([
    { key: "externalId", value: "remember-me", type: "uuid" },
    { key: "score", value: "", type: "decimal", min: "1.25", max: "9.75" },
    { key: "source", value: "constant" },
  ]);
  expect(submitted.config.metadataReferenceDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const keyBox = await page
    .getByLabel("Customer metadata key 3", { exact: true })
    .boundingBox();
  const typeBox = await page
    .getByRole("combobox", { name: "Customer metadata type 3", exact: true })
    .boundingBox();
  const valueBox = await page
    .getByLabel("Customer metadata value 3", { exact: true })
    .boundingBox();
  expect(keyBox!.x).toBeLessThan(typeBox!.x);
  expect(typeBox!.x).toBeLessThan(valueBox!.x);
  await page.screenshot({
    path: "test-results/metadata-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/metadata-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("reset confirms, restores defaults, clears pending batches and optionally forgets the API key", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.goto("/");
  const saved = {
    apiKey: "sk_test_reset_fixture",
    testClockId: "clock_reset123",
    rememberKey: true,
    count: "42",
    nameType: "person",
    domain: "reset.example.com",
    country: "US",
    overrides: { line1: "Keep until confirmed" },
    customerMetadata: [{ key: "id", value: "", type: "uuid" }],
    subscriptionMetadata: [{ key: "source", value: "test" }],
    productId: "prod_demo",
    priceId: "price_demo",
    couponId: "coupon_demo",
    offline: true,
    netD: "90",
    quantityMode: "fixed",
    quantity: "27",
  };
  await page.evaluate((settings) => {
    localStorage.setItem("stripe-seeder-settings-v1", JSON.stringify(settings));
    localStorage.setItem("unrelated-setting", "keep");
    sessionStorage.setItem(
      "stripe-seeder-pending-run",
      JSON.stringify({
        id: "50091123-d9dd-4d0c-a6c3-a713290af934",
        total: 42,
        completed: 0,
        createdAt: Date.now(),
        results: [],
        keyFingerprint: "fixture",
        config: {
          ...settings,
          addressOverrides: settings.overrides,
          daysUntilDue: 90,
          quantity: 27,
        },
      }),
    );
  }, saved);
  await page.reload();
  await expect(page.getByText("●  Stripe connected")).toBeVisible();
  await expect(page.getByText("Batch paused", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Reset Everything", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Do not clear API key")).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Number of customers")).toHaveValue("42");
  await expect(page.getByLabel("Test Clock ID")).toHaveValue("clock_reset123");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("stripe-seeder-pending-run"),
    ),
  ).not.toBeNull();
  await page
    .getByRole("button", { name: "Reset Everything", exact: true })
    .click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Secret API key")).toHaveValue(saved.apiKey);
  await expect(page.getByLabel("Number of customers")).toHaveValue("10");
  await expect(page.getByLabel("Test Clock ID")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Company", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Email domain")).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Country", exact: true }),
  ).toHaveText("United Kingdom");
  await expect(
    page.getByLabel("Customer metadata key 1", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Customer metadata type 1" }),
  ).toHaveText("Custom text");
  await expect(
    page.getByLabel("Subscription metadata value 1", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Random · 1–999" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Offline/Invoice payment method"),
  ).not.toBeChecked();
  await expect(page.getByText("Batch paused", { exact: true })).toHaveCount(0);
  const storage = await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("stripe-seeder-settings-v1")!),
    pending: sessionStorage.getItem("stripe-seeder-pending-run"),
    unrelated: localStorage.getItem("unrelated-setting"),
  }));
  expect(storage.pending).toBeNull();
  expect(storage.unrelated).toBe("keep");
  expect(storage.settings).toMatchObject({
    apiKey: saved.apiKey,
    testClockId: "",
    productId: "",
    priceId: "",
    couponId: "",
    overrides: {},
    netD: "30",
    quantity: "1",
  });
  await page.reload();
  await expect(page.getByText("●  Stripe connected")).toBeVisible();
  await expect(page.getByLabel("Number of customers")).toHaveValue("10");
  await expect(page.getByLabel("Test Clock ID")).toHaveValue("");
  await page
    .getByRole("button", { name: "Reset Everything", exact: true })
    .click();
  await dialog.getByLabel("Do not clear API key").uncheck();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Secret API key")).toHaveValue(saved.apiKey);
  await page
    .getByRole("button", { name: "Reset Everything", exact: true })
    .click();
  await expect(dialog.getByLabel("Do not clear API key")).toBeChecked();
  await dialog.getByLabel("Do not clear API key").uncheck();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByLabel("Secret API key")).toHaveValue("");
  await expect(page.getByText("○  Not connected")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("stripe-seeder-settings-v1"),
    ),
  ).not.toContain(saved.apiKey);
  await page.reload();
  await expect(page.getByLabel("Secret API key")).toHaveValue("");
});

test("fixed progress details scroll within the viewport on desktop and mobile", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "stripe-seeder-pending-run",
      JSON.stringify({
        id: "50091123-d9dd-4d0c-a6c3-a713290af934",
        total: 101,
        completed: 100,
        createdAt: Date.now(),
        keyFingerprint: "fixture",
        config: {
          nameType: "company",
          domain: "",
          country: "GB",
          addressOverrides: {},
          priceId: "price_demo",
          couponId: "",
          customerMetadata: [],
          subscriptionMetadata: [],
          offline: false,
        },
        results: Array.from({ length: 100 }, (_, i) => ({
          customerId: `cus_${i}`,
          subscriptionId: `sub_${i}`,
          name: `Company ${i}`,
          email: `sample${i}@example.com`,
          status: "active",
        })),
      }),
    );
  });
  await page.goto("/");
  const progress = page.getByRole("region", { name: "Batch progress" });
  await expect(progress.getByText("100 / 101 created")).toBeVisible();
  await progress.getByRole("button", { name: "Expand batch details" }).click();
  await expect(progress.getByText("Company 0", { exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bounds = await progress.boundingBox();
    expect(bounds!.y + bounds!.height).toBeCloseTo(844, 0);
    expect(bounds!.height).toBeLessThan(500);
    const scrollArea = page
      .locator("#batch-progress-details")
      .locator(".MuiCollapse-wrapperInner > div");
    expect(
      await scrollArea.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    await scrollArea.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(
      progress.getByText("Company 99", { exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/progress-${width}.png`,
      animations: "disabled",
    });
  }
  await progress
    .getByRole("button", { name: "Collapse batch details" })
    .click();
  await expect(progress.getByText("Company 99", { exact: true })).toHaveCount(
    0,
  );
});
