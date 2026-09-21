import test from "node:test";
import assert from "node:assert/strict";
import {
  metadataTypes,
  metadataSchema,
  type MetadataRow,
} from "../src/lib/metadata";
import { generateMetadata } from "../src/lib/generate-metadata";

const anchor = "2026-09-21T12:00:00.000Z";
const rows: MetadataRow[] = metadataTypes.map((type) => ({
  key: type.id,
  type: type.id,
  value: "",
}));
test("all offered generators produce Stripe-compatible strings and retries reproduce values", () => {
  const first = generateMetadata(rows, "run:0:customer", "GB", anchor);
  assert.equal(Object.keys(first).length, metadataTypes.length);
  for (const value of Object.values(first))
    assert(
      typeof value === "string" && value.length > 0 && value.length <= 500,
    );
  assert.deepEqual(
    first,
    generateMetadata(rows, "run:0:customer", "GB", anchor),
  );
  assert.notEqual(
    first.uuid,
    generateMetadata(rows, "run:1:customer", "GB", anchor).uuid,
  );
  assert.notEqual(
    first.uuid,
    generateMetadata(rows, "run:0:subscription", "GB", anchor).uuid,
  );
  assert.match(first.uuid, /^[0-9a-f-]{36}$/);
  assert.match(first.shortId, /^[a-z0-9]{12}$/);
  assert.match(first.countryCode, /^[A-Z]{2}$/);
  assert.match(first.boolean, /^(true|false)$/);
  assert.match(first.decimal, /^\d+\.\d{2}$/);
  assert(first.pastDate >= "2025-09-21" && first.pastDate <= "2026-09-21");
  assert(first.futureDate >= "2026-09-21" && first.futureDate <= "2027-09-21");
});
test("metadata generation preserves constants, field independence and configured bounds", () => {
  const data: MetadataRow[] = [
    { key: "literal", value: "00123" },
    { key: "integer", value: "", type: "integer", min: "-9", max: "-9" },
    { key: "decimal", value: "", type: "decimal", min: "0.29", max: "0.29" },
    { key: "id", value: "", type: "shortId", length: "8" },
    { key: "", value: "" },
  ];
  const result = generateMetadata(data, "seed", "US");
  assert.equal(result.literal, "00123");
  assert.equal(result.integer, "-9");
  assert.equal(result.decimal, "0.29");
  assert.match(result.id, /^[a-z0-9]{8}$/);
  assert.equal(Object.keys(result).length, 4);
  assert.deepEqual(result, generateMetadata([...data].reverse(), "seed", "US"));
});
test("metadata validates generator choices, keys, bounds, lengths and legacy text rows", () => {
  assert(metadataSchema.safeParse([{ key: "old", value: "text" }]).success);
  assert(metadataSchema.safeParse(rows).success);
  for (const row of [
    { key: "a", value: "", type: "unknown" },
    { key: "", value: "", type: "uuid" },
    { key: "a", value: "", type: "integer", min: "2", max: "1" },
    { key: "a", value: "", type: "integer", min: "" },
    { key: "a", value: "", type: "integer", min: "1.5" },
    { key: "a", value: "", type: "decimal", min: "0.001" },
    { key: "a", value: "", type: "decimal", max: "Infinity" },
    { key: "a", value: "", type: "shortId", length: "0" },
    { key: "a", value: "", type: "shortId", length: "101" },
    { key: "a", value: "", type: "shortId", length: "1.5" },
  ])
    assert.equal(
      metadataSchema.safeParse([row]).success,
      false,
      JSON.stringify(row),
    );
  assert.equal(
    metadataSchema.safeParse([
      { key: "a", value: "", type: "uuid" },
      { key: "a", value: "constant" },
    ]).success,
    false,
  );
  assert.throws(
    () =>
      generateMetadata(
        [{ key: "date", value: "", type: "pastDate" }],
        "seed",
        "GB",
      ),
    /reference date/,
  );
});
