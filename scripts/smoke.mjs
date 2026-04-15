/**
 * Smoke test: GET health while API is running.
 * Usage: SMOKE_BASE_URL=http://127.0.0.1:4000 node scripts/smoke.mjs
 */
const base = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const url = `${base}/make-server-f9553289/health`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`smoke: HTTP ${res.status} from ${url}`);
  process.exit(1);
}
const body = await res.json();
if (body?.status !== "ok") {
  console.error("smoke: unexpected body", body);
  process.exit(1);
}
console.log("smoke: ok", body);
