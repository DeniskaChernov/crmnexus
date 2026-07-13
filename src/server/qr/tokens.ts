import { randomBytes } from "node:crypto";

/** Непрогнозируемый публичный токен для URL /r/{token} */
export function generateQrToken(): string {
  return randomBytes(8).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();
}

export function publicQrUrl(token: string, base?: string): string {
  const root = (base || process.env["BENTENTRADE_SITE_URL"] || "https://bententrade.uz").replace(/\/$/, "");
  return `${root}/r/${token}`;
}

/** QR → форма отзыва на сайте */
export function publicQrReviewUrl(token: string, base?: string): string {
  return `${publicQrUrl(token, base)}/review`;
}

/** QR → каталог / ассортимент на сайте */
export function publicQrCatalogUrl(token: string, base?: string): string {
  return `${publicQrUrl(token, base)}/catalog`;
}

export function publicQrUrls(token: string, base?: string) {
  return {
    main: publicQrUrl(token, base),
    review: publicQrReviewUrl(token, base),
    catalog: publicQrCatalogUrl(token, base),
  };
}

export async function nextPublicCode(pool: { query: (sql: string) => Promise<{ rows: { n: string }[] }> }): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(`SELECT nextval('rattan_coil_code_seq') AS n`);
  const n = Number(rows[0]?.n ?? 1);
  return `BTT-${year}-${String(n).padStart(6, "0")}`;
}
