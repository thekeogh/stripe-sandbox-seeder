export function formatMajorAmount(value: string): string | null {
  const plain = value.replaceAll(",", "");
  if (!/^\d*(?:\.\d{0,2})?$/.test(plain)) return null;
  const [whole, fraction] = plain.split(".");
  const grouped = (whole || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function majorAmountToMinor(value: string): number | null {
  const plain = value.replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(plain)) return null;
  const [whole, fraction = ""] = plain.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}
