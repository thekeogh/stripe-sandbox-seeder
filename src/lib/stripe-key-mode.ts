export function stripeKeyMode(key: string): "test" | "live" | "unknown" {
  if (/^(sk|rk)_test_/.test(key.trim())) return "test";
  if (/^(sk|rk)_live_/.test(key.trim())) return "live";
  return "unknown";
}
