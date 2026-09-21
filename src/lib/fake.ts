import {
  Faker,
  en,
  en_GB,
  en_US,
  en_CA,
  en_AU,
  en_IE,
  de,
  fr,
  es,
  it,
  nl,
  en_IN,
  ja,
  pt_BR,
  base,
} from "@faker-js/faker";
import { createHash } from "node:crypto";
import type { Country, ProfileConfig } from "./schema";
const locales = {
  GB: en_GB,
  US: en_US,
  CA: en_CA,
  AU: en_AU,
  IE: en_IE,
  DE: de,
  FR: fr,
  ES: es,
  IT: it,
  NL: nl,
  IN: en_IN,
  JP: ja,
  BR: pt_BR,
};
function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function fakeCustomer(config: ProfileConfig, seed: string) {
  const faker = new Faker({
    locale: [locales[config.country as Country], en, base],
  });
  faker.seed(createHash("sha256").update(seed).digest().readUInt32BE(0));
  const ukPlace = faker.helpers.arrayElement([
    { city: "London", state: "Greater London", area: "SW" },
    { city: "Manchester", state: "Greater Manchester", area: "M" },
    { city: "Leeds", state: "West Yorkshire", area: "LS" },
    { city: "Bristol", state: "Bristol", area: "BS" },
    { city: "Newcastle upon Tyne", state: "Tyne and Wear", area: "NE" },
    { city: "Birmingham", state: "West Midlands", area: "B" },
    { city: "Edinburgh", state: "City of Edinburgh", area: "EH" },
    { city: "Cardiff", state: "Cardiff", area: "CF" },
    { city: "Belfast", state: "County Antrim", area: "BT" },
    { city: "Nottingham", state: "Nottinghamshire", area: "NG" },
  ]);
  // Sample city/state/ZIP tuples, selected together so generated addresses agree.
  // ZIPs are five-digit strings to preserve leading zeroes (for example Boston).
  const usPlace =
    config.country === "US"
      ? faker.helpers.arrayElement([
          { city: "Seattle", state: "WA", postal_code: "98104" },
          { city: "Boston", state: "MA", postal_code: "02201" },
          { city: "New Orleans", state: "LA", postal_code: "70112" },
          { city: "Austin", state: "TX", postal_code: "78701" },
          { city: "San Francisco", state: "CA", postal_code: "94102" },
          { city: "Chicago", state: "IL", postal_code: "60602" },
        ])
      : undefined;
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name =
    config.nameType === "company"
      ? faker.company.name()
      : `${firstName} ${lastName}`;
  const domain =
    config.domain ||
    (config.nameType === "company"
      ? `${(slug(name) || slug(faker.internet.domainWord()) || faker.string.alpha({ length: 10, casing: "lower" })).slice(0, 60)}.${faker.internet.domainSuffix()}`
      : faker.internet.domainName());
  const local =
    config.nameType === "person"
      ? `${slug(firstName) || "user"}.${slug(lastName) || faker.string.alpha(5)}`
      : faker.internet
          .username()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "");
  return {
    name,
    email: `${(local || faker.string.alpha({ length: 10, casing: "lower" })).slice(0, 64)}@${domain}`,
    address: {
      line1: faker.location.streetAddress(),
      line2: faker.datatype.boolean({ probability: 0.3 })
        ? faker.location.secondaryAddress()
        : "",
      city:
        usPlace?.city ??
        (config.country === "GB" ? ukPlace.city : faker.location.city()),
      state:
        usPlace?.state ??
        (config.country === "GB" ? ukPlace.state : faker.location.state()),
      postal_code:
        config.country === "GB"
          ? `${ukPlace.area}${faker.number.int({ min: 1, max: 20 })} ${faker.number.int({ min: 0, max: 9 })}${faker.string.fromCharacters("ABDEFGHJLNPQRSTUWXYZ", 2)}`
          : (usPlace?.postal_code ?? faker.location.zipCode()),
      ...config.addressOverrides,
      country: config.country,
    },
  };
}
