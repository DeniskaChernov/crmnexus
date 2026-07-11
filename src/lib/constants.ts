/** Единый префикс HTTP API (ранее legacy Supabase Edge Function). */
export const API_PREFIX = "/api";

/** Основной склад BTT Nexus. AIKO/Bizly объединены в BTT. */
export const DEFAULT_WAREHOUSE = "BTT";

export function normalizeWarehouse(wh?: string | null): string {
  if (!wh || wh === "AIKO" || wh === "Bizly") return DEFAULT_WAREHOUSE;
  return wh;
}
