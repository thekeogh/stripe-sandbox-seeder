import { z } from "zod";

export const countries = {
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  IN: "India",
  JP: "Japan",
  BR: "Brazil",
} as const;
export type Country = keyof typeof countries;
export const countrySchema = z.enum(
  Object.keys(countries) as [Country, ...Country[]],
);
export const addressSchema = z.object({
  line1: z.string().max(200),
  line2: z.string().max(200),
  city: z.string().max(100),
  state: z.string().max(100),
  postal_code: z.string().max(20),
});
export type Address = z.infer<typeof addressSchema>;
export type MetadataRow = { key: string; value: string };
const metadataSchema = z
  .array(
    z.object({
      key: z
        .string()
        .trim()
        .max(40)
        .refine(
          (k) => !/[\[\]]/.test(k),
          "Metadata keys cannot contain brackets.",
        ),
      value: z.string().max(500),
    }),
  )
  .superRefine((rows, ctx) => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (!row.key && row.value)
        ctx.addIssue({
          code: "custom",
          message: "Every metadata value needs a key.",
        });
      if (row.key && !row.value)
        ctx.addIssue({
          code: "custom",
          message: "Every metadata key needs a value.",
        });
      if (row.key && keys.has(row.key))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate metadata key: ${row.key}`,
        });
      if (row.key) keys.add(row.key);
    }
    if (keys.size > 50)
      ctx.addIssue({
        code: "custom",
        message: "Stripe allows 50 metadata entries.",
      });
  });
export const profileSchema = z.object({
  nameType: z.enum(["company", "person"]),
  domain: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, "").toLowerCase())
    .refine(
      (s) =>
        !s ||
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
          s,
        ),
      "Enter a domain such as whatever.com.",
    ),
  country: countrySchema,
  addressOverrides: addressSchema.partial(),
});
export const configSchema = profileSchema
  .extend({
    priceId: z.string().startsWith("price_"),
    couponId: z.string(),
    customerMetadata: metadataSchema,
    subscriptionMetadata: metadataSchema,
    offline: z.boolean(),
    daysUntilDue: z.number().int().min(0).max(730).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.offline && v.daysUntilDue === undefined)
      ctx.addIssue({ code: "custom", message: "Enter Net D payment terms." });
    if (
      v.offline &&
      v.customerMetadata.filter((r) => r.key && r.key !== "isInvoiced")
        .length >= 50
    )
      ctx.addIssue({
        code: "custom",
        message: "Leave one customer metadata slot for isInvoiced.",
      });
  });
export const seedSchema = z.object({
  runId: z.uuid(),
  index: z.number().int().nonnegative().refine(Number.isSafeInteger),
  config: configSchema,
});
export type SeedConfig = z.infer<typeof configSchema>;
export type ProfileConfig = z.infer<typeof profileSchema>;
export const metadataObject = (rows: MetadataRow[]) =>
  Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.value]));
export type Catalog = {
  products: { id: string; name: string }[];
  prices: { id: string; productId: string; label: string; currency: string }[];
  coupons: {
    id: string;
    label: string;
    products: string[];
    currency: string | null;
  }[];
};
