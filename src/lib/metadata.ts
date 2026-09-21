import { z } from "zod";

export const metadataTypes = [
  {
    id: "uuid",
    label: "UUID",
    group: "Identifiers",
    example: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    id: "shortId",
    label: "Short alphanumeric ID",
    group: "Identifiers",
    example: "k9m2p7x4",
  },
  {
    id: "fullName",
    label: "Full name",
    group: "People",
    example: "Olivia Turner",
  },
  { id: "firstName", label: "First name", group: "People", example: "Olivia" },
  { id: "lastName", label: "Last name", group: "People", example: "Turner" },
  {
    id: "company",
    label: "Company name",
    group: "Business",
    example: "Turner & Sons",
  },
  {
    id: "jobTitle",
    label: "Job title",
    group: "Business",
    example: "Marketing Manager",
  },
  {
    id: "email",
    label: "Email address",
    group: "Contact",
    example: "olivia@example.com",
  },
  {
    id: "phone",
    label: "Phone number",
    group: "Contact",
    example: "+44 7700 900123",
  },
  {
    id: "url",
    label: "Website URL",
    group: "Contact",
    example: "https://example.com",
  },
  { id: "city", label: "City", group: "Location", example: "London" },
  {
    id: "country",
    label: "Country",
    group: "Location",
    example: "United Kingdom",
  },
  {
    id: "countryCode",
    label: "Country code",
    group: "Location",
    example: "GB",
  },
  { id: "integer", label: "Integer", group: "Values", example: "42" },
  { id: "decimal", label: "Decimal number", group: "Values", example: "24.95" },
  {
    id: "boolean",
    label: "Boolean",
    group: "Values",
    example: "true or false",
  },
  { id: "word", label: "Word", group: "Text & dates", example: "creative" },
  {
    id: "sentence",
    label: "Sentence",
    group: "Text & dates",
    example: "A short generated sentence.",
  },
  {
    id: "pastDate",
    label: "Past date",
    group: "Text & dates",
    example: "Within the past year · YYYY-MM-DD",
  },
  {
    id: "futureDate",
    label: "Future date",
    group: "Text & dates",
    example: "Within the next year · YYYY-MM-DD",
  },
] as const;
export type MetadataType = "custom" | (typeof metadataTypes)[number]["id"];
const typeIds = ["custom", ...metadataTypes.map((t) => t.id)] as [
  MetadataType,
  ...MetadataType[],
];
export const metadataRowSchema = z
  .object({
    key: z
      .string()
      .trim()
      .max(40)
      .refine(
        (k) => !/[\[\]]/.test(k),
        "Metadata keys cannot contain brackets.",
      ),
    value: z.string().max(500),
    type: z.enum(typeIds).optional(),
    min: z.string().max(32).optional(),
    max: z.string().max(32).optional(),
    length: z.string().max(3).optional(),
  })
  .superRefine((row, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({
        code: "custom",
        message: `${row.key || "Metadata"}: ${message}`,
      });
    const type = row.type ?? "custom";
    if (!row.key && (row.value || type !== "custom")) fail("enter a key.");
    if (row.key && type === "custom" && !row.value) fail("enter a value.");
    if (type === "integer" || type === "decimal") {
      const min = row.min ?? "0",
        max = row.max ?? "1000";
      const format = type === "integer" ? /^-?\d+$/ : /^-?\d+(\.\d{1,2})?$/;
      if (
        ![min, max].every(
          (v) =>
            format.test(v) &&
            Number.isFinite(Number(v)) &&
            Math.abs(Number(v)) <= 1_000_000_000,
        )
      )
        fail(
          type === "integer"
            ? "Min and Max must be whole numbers between -1 billion and 1 billion."
            : "Min and Max must be numbers with up to two decimal places between -1 billion and 1 billion.",
        );
      else if (Number(min) > Number(max)) fail("Min cannot exceed Max.");
    }
    if (
      type === "shortId" &&
      (!/^\d+$/.test(row.length ?? "12") ||
        Number(row.length ?? "12") < 1 ||
        Number(row.length ?? "12") > 100)
    )
      fail("ID length must be a whole number from 1 to 100.");
  });
export type MetadataRow = z.infer<typeof metadataRowSchema>;
export const metadataSchema = z
  .array(metadataRowSchema)
  .superRefine((rows, ctx) => {
    const keys = new Set<string>();
    for (const row of rows) {
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
