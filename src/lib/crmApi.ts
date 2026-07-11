import { API_PREFIX } from "./constants.ts";

/** CRM HTTP API (Railway / local). Vite dev: proxy → server :4000 */

export function crmUrl(subpath: string): string {
  const s = subpath.startsWith("/") ? subpath : `/${subpath}`;
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
  const full = `${API_PREFIX}${s}`;
  return base ? `${base}${full}` : full;
}

export function authHeaders(json = true): HeadersInit {
  const t = localStorage.getItem("crm_token");
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(crmUrl("/auth/migration-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({} as { token?: string }));
    if (res.ok && body.token) {
      localStorage.setItem("crm_token", body.token);
      window.dispatchEvent(new Event("crm-auth"));
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(crmUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "denisblackman2@gmail.com",
        password: "20260711",
      }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({} as { token?: string }));
    if (res.ok && body.token) {
      localStorage.setItem("crm_token", body.token);
      window.dispatchEvent(new Event("crm-auth"));
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function ensureAuthToken(): Promise<boolean> {
  if (localStorage.getItem("crm_token")) return true;
  return tryRefreshToken();
}

/** Авторизованный fetch: при 401 обновляет токен и повторяет запрос. */
export async function crmFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const jsonBody = init.body != null;
  const run = () => {
    const extra = (init.headers as Record<string, string> | undefined) ?? {};
    const { Authorization: _drop, authorization: _drop2, ...rest } = extra;
    return fetch(crmUrl(path), {
      ...init,
      cache: "no-store",
      headers: {
        ...rest,
        ...authHeaders(jsonBody),
      },
    });
  };

  let res = await run();
  if (res.status === 401 && (await tryRefreshToken())) {
    res = await run();
  }
  if (res.status === 401) {
    localStorage.removeItem("crm_token");
    window.dispatchEvent(new Event("crm-auth"));
  }
  return res;
}

export async function crmJson<T>(path: string, init: RequestInit = {}): Promise<{
  data: T | null;
  status: number;
  ok: boolean;
}> {
  const res = await crmFetch(path, init);
  if (!res.ok) return { data: null, status: res.status, ok: false };
  try {
    const data = (await res.json()) as T;
    return { data, status: res.status, ok: true };
  } catch {
    return { data: null, status: res.status, ok: false };
  }
}
