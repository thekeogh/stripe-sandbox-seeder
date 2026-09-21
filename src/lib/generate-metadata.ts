import { createHash } from "node:crypto";
import { Faker, en, base } from "@faker-js/faker";
import { locales } from "./fake";
import type { Country } from "./schema";
import type { MetadataRow } from "./metadata";

export function generateMetadata(
  rows: MetadataRow[],
  seed: string,
  country: Country,
  referenceDate?: string,
): Record<string, string> {
  return Object.fromEntries(
    rows
      .filter((row) => row.key)
      .map((row) => {
        if (!row.type || row.type === "custom") return [row.key, row.value];
        const faker = new Faker({ locale: [locales[country], en, base] });
        faker.seed(
          createHash("sha256")
            .update(JSON.stringify([seed, row.key]))
            .digest()
            .readUInt32BE(0),
        );
        const min = Number(row.min ?? "0"),
          max = Number(row.max ?? "1000");
        let value: string;
        switch (row.type) {
          case "uuid":
            value = faker.string.uuid();
            break;
          case "shortId":
            value = faker.string.alphanumeric({
              length: Number(row.length ?? "12"),
              casing: "lower",
            });
            break;
          case "fullName":
            value = `${faker.person.firstName()} ${faker.person.lastName()}`;
            break;
          case "firstName":
            value = faker.person.firstName();
            break;
          case "lastName":
            value = faker.person.lastName();
            break;
          case "company":
            value = faker.company.name();
            break;
          case "jobTitle":
            value = faker.person.jobTitle();
            break;
          case "email":
            value = faker.internet.email();
            break;
          case "phone":
            value = faker.phone.number();
            break;
          case "url":
            value = faker.internet.url();
            break;
          case "city":
            value = faker.location.city();
            break;
          case "country":
            value = faker.location.country();
            break;
          case "countryCode":
            value = faker.location.countryCode();
            break;
          case "integer":
            value = String(faker.number.int({ min, max }));
            break;
          case "decimal":
            value = (
              faker.number.int({
                min: Math.round(min * 100),
                max: Math.round(max * 100),
              }) / 100
            ).toFixed(2);
            break;
          case "boolean":
            value = String(faker.datatype.boolean());
            break;
          case "word":
            value = faker.word.sample();
            break;
          case "sentence":
            value = faker.lorem.sentence();
            break;
          case "pastDate":
          case "futureDate": {
            if (!referenceDate)
              throw new Error(
                "Generated metadata dates require a fixed reference date.",
              );
            const anchor = new Date(referenceDate);
            const boundary = new Date(anchor);
            boundary.setUTCFullYear(
              anchor.getUTCFullYear() + (row.type === "pastDate" ? -1 : 1),
            );
            value = faker.date
              .between({
                from: row.type === "pastDate" ? boundary : anchor,
                to: row.type === "pastDate" ? anchor : boundary,
              })
              .toISOString()
              .slice(0, 10);
            break;
          }
          default:
            throw new Error("Unsupported metadata generator.");
        }
        return [row.key, value.slice(0, 500)];
      }),
  );
}
