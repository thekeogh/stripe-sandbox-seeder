import { expect, test } from "@playwright/test";
const catalog = {
  products: [{ id: "prod_demo", name: "Starter" }],
  prices: [
    {
      id: "price_demo",
      productId: "prod_demo",
      currency: "gbp",
      label: "£20.00 / month",
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
  expect(payloads).toHaveLength(2);
  expect(payloads[0].config).toMatchObject({
    offline: true,
    daysUntilDue: 45,
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
    page
      .getByRole("alert")
      .filter({
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
  await page.getByLabel(/Remember API key/).uncheck();
  await page.reload();
  await expect(page.getByLabel("Secret API key")).toHaveValue("");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stripe-seeder-settings-v1")!),
  );
  expect(saved.apiKey).toBe("");
  expect(saved.priceId).toBe("price_demo");
});
