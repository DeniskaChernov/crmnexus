import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "./dbPool.ts";
import * as kv from "./kv_store.ts";

function hexDigest(secret: string, raw: string) {
  return createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function safeEqual(a: string, b: string) {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifySiteWebhookSignature(rawBody: string, secret: string, header: string | undefined) {
  if (!secret || !header) return false;
  const expectedHex = hexDigest(secret, rawBody);
  const sig = header.trim();
  const normalized = sig.startsWith("sha256=") ? sig.slice(7).trim() : sig.trim();
  return safeEqual(expectedHex, normalized);
}

/** btt-site compatible: lead.submitted, order.created */
export async function handleSiteWebhook(opts: {
  rawBody: string;
  event: string | undefined;
  schemaVersion: string | undefined;
  idempotencyKey: string | undefined;
  signature: string | undefined;
  secret: string;
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const { rawBody, event, idempotencyKey, secret, signature } = opts;

  if (!verifySiteWebhookSignature(rawBody, secret, signature)) {
    return { ok: false, status: 401, body: { error: "invalid signature" } };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, body: { error: "invalid json" } };
  }

  const pool = getPool();
  if (idempotencyKey) {
    const ins = await pool.query(
      `INSERT INTO webhook_idempotency (idempotency_key, event_type) VALUES ($1, $2)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
      [idempotencyKey, event || "unknown"],
    );
    if (ins.rowCount === 0) {
      return { ok: true, status: 200, body: { duplicate: true } };
    }
  }

  if (event === "lead.submitted") {
    const name = String(payload["name"] ?? payload["fullName"] ?? "").trim() || "Сайт";
    const phone = String(payload["phone"] ?? payload["tel"] ?? "").trim();
    if (!phone) {
      return { ok: false, status: 400, body: { error: "phone required" } };
    }
    const id = `lead:${Date.now()}`;
    const lead = {
      id,
      name,
      phone,
      info: String(payload["message"] ?? payload["info"] ?? ""),
      status: "new",
      country: String(payload["country"] ?? "Uzbekistan"),
      source: "btt-site",
      createdAt: new Date().toISOString(),
    };
    await kv.set(id, lead);
    return { ok: true, status: 200, body: { received: true, leadId: id } };
  }

  if (event === "order.created") {
    const id = `site-order:${Date.now()}`;
    await kv.set(id, { ...payload, receivedAt: new Date().toISOString() });
    return { ok: true, status: 200, body: { received: true, key: id } };
  }

  return { ok: true, status: 200, body: { received: true, ignored: true, event } };
}
