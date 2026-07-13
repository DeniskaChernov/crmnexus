const SITE = (import.meta.env.VITE_BENTENTRADE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://bententrade.uz";

export function qrUrlsForToken(token: string) {
  const main = `${SITE}/r/${token}`;
  return {
    main,
    review: `${main}/review`,
    catalog: `${main}/catalog`,
  };
}
