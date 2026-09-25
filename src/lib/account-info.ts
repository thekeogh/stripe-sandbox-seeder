import type Stripe from "stripe";

export type AccountInfo = {
  id: string;
  dashboardName: string | null;
  businessName: string | null;
  email: string | null;
  country: string | null;
  defaultCurrency: string | null;
  businessType: string | null;
  accountType: string | null;
};

export function accountInfo(account: Stripe.Account): AccountInfo {
  return {
    id: account.id,
    dashboardName: account.settings?.dashboard?.display_name || null,
    businessName:
      account.business_profile?.name || account.company?.name || null,
    email: account.email || null,
    country: account.country || null,
    defaultCurrency: account.default_currency || null,
    businessType: account.business_type || null,
    accountType: account.type || null,
  };
}
