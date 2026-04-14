/** CRM HTTP API (Railway / local). Vite dev: proxy → server :4000 */

export function crmUrl(subpath: string): string {
  const s = subpath.startsWith("/") ? subpath : `/${subpath}`;
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
  const full = `/make-server-f9553289${s}`;
  return base ? `${base}${full}` : full;
}

export function authHeaders(json = true): HeadersInit {
  const t = localStorage.getItem("crm_token");
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}
