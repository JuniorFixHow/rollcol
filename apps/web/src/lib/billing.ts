import "server-only";
import { type BillingCatalog, type Database, billingCatalogSchema } from "@rollcol/shared";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * The price list, from the database (one place for prices). Public, the same
 * for everyone, so it is cached for an hour.
 */
export async function getCatalog(): Promise<BillingCatalog> {
  "use cache";
  cacheLife("hours");
  const { url, key } = getSupabaseEnv();
  const supabase = createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("billing_catalog");
  if (error) throw new Error(error.message);
  const parsed = billingCatalogSchema.safeParse(data);
  if (!parsed.success) throw new Error("The price list could not be read.");
  return parsed.data;
}
