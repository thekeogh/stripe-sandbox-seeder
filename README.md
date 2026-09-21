# stripe-sandbox-seeder

A local Next.js + TypeScript app with a dark Material UI interface, Faker-generated customers, and one Stripe subscription per customer.

## Run

```sh
npm install
npm run dev
```

`npm run dev` opens <http://127.0.0.1:43187> in your default browser once Next.js is ready. Use `npm run dev:server` to run without opening a browser.

In the app, paste a **sandbox secret API key** into **Stripe connection**, and click **Connect**. Select a product and recurring price, configure your customers, and click **Seed customers**.

You can alternatively set `STRIPE_SECRET_KEY` in `.env.local` using `.env.example`, then connect with an empty key field. The UI key takes precedence. Live keys are always rejected. The app binds to localhost and is intended for personal local use; it does not include hosted multi-user authentication.

## What it creates

- Company names by default, or first and last names, generated using Faker.
- Company-derived email domains or random person domains, with an optional shared domain override (`@whatever.com` and `whatever.com` both work).
- Country-specific synthetic addresses for the 13 countries in the selector. These are sample addresses, not deliverability-verified addresses. UK postcodes use an explicit valid format because Faker can produce malformed inward codes. US addresses use Faker to choose one of six matching city/state/five-digit ZIP tuples, retaining leading zeroes. Street addresses remain synthetic.
- A fresh address for each customer. Manually edited fields override those fields for every customer. **Regenerate** clears address overrides and makes a new preview.
- Separate customer and subscription metadata editors. Each row defaults to **Custom text**, or choose one of 20 grouped Faker types: UUID, short alphanumeric ID, full/first/last name, company, job title, email, phone, website URL, city, country, country code, integer, decimal, boolean, word, sentence, past date or future date. Numbers have Min/Max controls (up to ±1 billion; decimals use two places), and short IDs have a Length control (1–100, default 12). Dates use `YYYY-MM-DD` within one year of the batch start. Examples are illustrative; generated values are independent per field and per object, not copies of the customer profile. All generated values are sent to Stripe as strings. The batch reference date and field-specific Faker seeds keep retries stable. Switching back to custom text preserves the original text.
- Metadata types and options are saved with the form. Enter in a text/number input inserts and focuses the next row; plus and minus insert/remove rows. Stripe's metadata limits, duplicate keys and generator options are validated before writes.
- Products, active recurring prices and valid compatible coupons loaded from Stripe, including pagination. This uses the Products and Prices APIs, never the Plans API. Quantity defaults to **Random (1–999)**, independently generated with Faker for each subscription. Choose **Fixed quantity** to set the same positive whole number of seats or licences for every subscription. Both the mode and fixed value are saved. Retrying a customer keeps its original random quantity. Metered prices omit quantity, since Stripe uses reported usage. Successful test payment methods are created, attached to the customer and set as the invoice default before card-paid subscriptions are created.
- Automatically charged subscriptions get a fresh Visa test payment method using Stripe's `tok_visa` token. Payment must succeed to create the subscription.
- Offline subscriptions use `collection_method: send_invoice`, `days_until_due`, and card-only payment settings. Customer metadata gets `isInvoiced: "true"` **before** the subscription is created; this overrides a conflicting customer entry. Stripe metadata values are strings.

The [invoicing runbook](https://app.notion.com/p/screencloud/Billing-Invoiced-Customer-Runbook-3bcceb3b14e780fa9bbff3321cc49da0) also asks you to uncheck **Include a link to a payment page in the invoice email**. The seeder does not apply that Dashboard setting. Check it in Stripe when testing the complete runbook. Creating Stripe records does not create Arc auth accounts or supply Arc-specific metadata; enter any needed metadata in the form.

## Saved settings and batches

**Reset Everything** opens an OK/Cancel dialog. It restores form defaults and clears local batch progress and results. **Do not clear API key** is checked each time the dialog opens; leave it checked to retain your key and its existing remember-key preference, or uncheck it to remove the key from the form and browser storage. Reset is disabled while seeding or connecting. Existing Stripe records and unrelated browser storage are untouched.

All form preferences persist in **localStorage**, including both metadata lists, address overrides, count, country, product, price, coupon, quantity and Net D. **Remember API key** is enabled by default and stores the secret in localStorage too; uncheck it to remove the saved key while retaining the other preferences. Keys are sent in request bodies to the local server and then used by the official Stripe SDK, never included in URLs.

Batches run sequentially, with no application-imposed count cap beyond JavaScript's safe integer range. Keep the tab open while running. Pause finishes the current customer/subscription pair before stopping. Unfinished progress is saved in **sessionStorage** and survives reloads in the same tab. Resume requires the same key and reuses the same data and Stripe idempotency keys. Resuming is disabled after 23 hours because Stripe may discard idempotency keys after 24 hours. The most recent 100 results are shown.

A definitive subscription rejection triggers deletion of that batch's newly created customer. An ambiguous network failure preserves the customer because Stripe may already have created the subscription; resume the batch to reconcile using idempotency. Any failed cleanup identifies the customer to inspect. Completed pairs remain in Stripe when you finish a partially completed batch. Stripe writes are not atomic, so external outages can still require inspection of the reported customer.

## Checks

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit tests cover the generated data, validation, automatic and offline subscription payloads, deterministic retries and cleanup. Browser tests cover connection, saved fields, metadata controls, mobile layout, and batch submission/retry. Stripe calls in tests are mocked; no tests create real sandbox records.

Reference: [Stripe subscription creation](https://docs.stripe.com/api/subscriptions/create), [Products](https://docs.stripe.com/api/products/list), [Prices](https://docs.stripe.com/api/prices/list), [Coupons](https://docs.stripe.com/api/coupons/list).

US location fixtures are based on municipal contact addresses: [Seattle](https://www.seattle.gov/city-clerk/about-us/contact-the-office-of-city-clerk), [Boston](https://www.boston.gov/departments/mayors-office/contact-boston-city-hall), [New Orleans](https://nola.gov/contact-us/), [Austin](https://www.austintexas.gov/contact), [San Francisco](https://www.sf.gov/departments--controllers-office), and [Chicago](https://www.chicago.gov/).
