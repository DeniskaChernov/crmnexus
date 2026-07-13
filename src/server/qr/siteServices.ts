import { createHash } from "node:crypto";
import { getPool } from "../dbPool.ts";
import { normalizePhone } from "./phone.ts";
import { getCoilByToken, recordCoilScan } from "./coilsService.ts";
import * as kv from "../kv_store.ts";

export type SiteEventPayload = Record<string, unknown>;

function ipHash(ip: string | undefined): string | null {
  if (!ip) return null;
  const salt = process.env["CRM_WEBHOOK_SECRET"] || "btt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function insertSiteEvent(opts: {
  event_id?: string;
  event_type: string;
  payload: SiteEventPayload;
  ip?: string;
  user_agent?: string;
}) {
  const pool = getPool();
  const p = opts.payload;
  const qr_token = typeof p["qr_token"] === "string" ? p["qr_token"] : undefined;
  let coil_id: string | null = null;
  let dealer_id: string | null = null;
  let deal_id: string | null = null;

  if (qr_token) {
    const coil = await getCoilByToken(qr_token);
    if (coil) {
      coil_id = coil.id;
      dealer_id = coil.company_id;
      deal_id = coil.deal_id;
    }
  }

  if (opts.event_id) {
    const dup = await pool.query(`SELECT 1 FROM site_events WHERE event_id = $1`, [opts.event_id]);
    if (dup.rows.length > 0) return { duplicate: true };
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO site_events (
      event_id, event_type, qr_token, coil_id, dealer_id, deal_id,
      website_user_id, session_id, country, phone, product_ref, color_ref, profile_ref,
      page_url, event_data, ip_hash, user_agent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING id`,
    [
      opts.event_id || null,
      opts.event_type,
      qr_token || null,
      coil_id,
      dealer_id,
      deal_id,
      typeof p["user_id"] === "string" ? p["user_id"] : (p["website_user_id"] as string) || null,
      typeof p["session_id"] === "string" ? p["session_id"] : null,
      typeof p["country"] === "string" ? p["country"] : null,
      typeof p["phone"] === "string" ? p["phone"] : null,
      typeof p["product_id"] === "string" ? p["product_id"] : (p["product_ref"] as string) || null,
      typeof p["color_id"] === "string" ? p["color_id"] : (p["color_ref"] as string) || null,
      typeof p["profile_id"] === "string" ? p["profile_id"] : (p["profile_ref"] as string) || null,
      typeof p["page_url"] === "string" ? p["page_url"] : null,
      JSON.stringify(p["event_data"] ?? p),
      ipHash(opts.ip),
      opts.user_agent || null,
    ],
  );

  return { id: rows[0]?.id, duplicate: false };
}

export async function upsertSiteCustomer(opts: {
  phone: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  website_user_id?: string;
  registration_source?: string;
  qr_token?: string;
}) {
  const pool = getPool();
  const phone_normalized = normalizePhone(opts.phone);
  if (!phone_normalized) throw new Error("Invalid phone");

  let source_dealer_id: string | null = null;
  if (opts.qr_token) {
    const coil = await getCoilByToken(opts.qr_token);
    source_dealer_id = coil?.company_id ?? null;
  }

  const now = new Date().toISOString();
  const { rows: existing } = await pool.query<{ id: string; assigned_dealer_id: string | null }>(
    `SELECT id, assigned_dealer_id FROM site_customers WHERE phone_normalized = $1`,
    [phone_normalized],
  );

  if (existing[0]) {
    const { rows } = await pool.query(
      `UPDATE site_customers SET
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        country = COALESCE($4, country),
        website_user_id = COALESCE($5, website_user_id),
        latest_source = COALESCE($6, latest_source),
        last_seen_at = $7,
        last_activity_at = $7,
        updated_at = $7
       WHERE id = $1 RETURNING *`,
      [
        existing[0].id,
        opts.first_name || null,
        opts.last_name || null,
        opts.country || null,
        opts.website_user_id || null,
        opts.registration_source || null,
        now,
      ],
    );
    return { customer: rows[0], created: false, existing_dealer_id: existing[0].assigned_dealer_id };
  }

  const { rows } = await pool.query(
    `INSERT INTO site_customers (
      phone_normalized, first_name, last_name, country, website_user_id,
      registration_source, first_source, latest_source, source_qr_token, source_dealer_id,
      first_seen_at, last_seen_at, last_activity_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$11)
    RETURNING *`,
    [
      phone_normalized,
      opts.first_name || null,
      opts.last_name || null,
      opts.country || null,
      opts.website_user_id || null,
      opts.registration_source || null,
      opts.registration_source || "website",
      opts.registration_source || "website",
      opts.qr_token || null,
      source_dealer_id,
      now,
    ],
  );
  return { customer: rows[0], created: true, existing_dealer_id: null };
}

export async function tryAssignDealerFromQr(customerId: string, qr_token: string) {
  const pool = getPool();
  const coil = await getCoilByToken(qr_token);
  if (!coil?.company_id) return { assigned: false, conflict: false };

  const { rows: cust } = await pool.query<{
    id: string;
    assigned_dealer_id: string | null;
    country: string | null;
  }>(`SELECT id, assigned_dealer_id, country FROM site_customers WHERE id = $1`, [customerId]);
  const customer = cust[0];
  if (!customer) return { assigned: false, conflict: false };

  const { rows: dealerRows } = await pool.query<{ country: string | null }>(
    `SELECT country FROM companies WHERE id = $1`,
    [coil.company_id],
  );
  const dealerCountry = dealerRows[0]?.country ?? null;
  const countryMatch =
    !customer.country || !dealerCountry
      ? true
      : customer.country.toLowerCase() === dealerCountry.toLowerCase();

  if (customer.assigned_dealer_id && customer.assigned_dealer_id !== coil.company_id) {
    await pool.query(
      `UPDATE site_customers SET assignment_status = 'conflict', updated_at = now() WHERE id = $1`,
      [customerId],
    );
    await kv.set(`notification:${Date.now()}`, {
      type: "dealer_assignment_conflict",
      customerId,
      existingDealerId: customer.assigned_dealer_id,
      attemptedDealerId: coil.company_id,
      qr_token,
      createdAt: new Date().toISOString(),
    });
    return { assigned: false, conflict: true, countryMatch };
  }

  if (!customer.assigned_dealer_id) {
    await pool.query(
      `UPDATE site_customers SET
        assigned_dealer_id = $2,
        assignment_status = $3,
        updated_at = now()
       WHERE id = $1`,
      [customerId, coil.company_id, countryMatch ? "assigned" : "review"],
    );
    await pool.query(
      `INSERT INTO customer_dealer_assignments (
        customer_id, dealer_id, assignment_source, assignment_qr_token,
        customer_country, dealer_country, country_match, status
      ) VALUES ($1,$2,'qr_scan',$3,$4,$5,$6,'active')`,
      [customerId, coil.company_id, qr_token, customer.country, dealerCountry, countryMatch],
    );
    if (!countryMatch) {
      await kv.set(`notification:${Date.now() + 1}`, {
        type: "dealer_country_mismatch",
        customerId,
        dealerId: coil.company_id,
        qr_token,
        createdAt: new Date().toISOString(),
      });
    }
    return { assigned: true, conflict: false, countryMatch };
  }

  return { assigned: true, conflict: false, countryMatch };
}

export async function createSiteRequest(payload: SiteEventPayload) {
  const pool = getPool();
  const phone = typeof payload["phone"] === "string" ? payload["phone"] : "";
  let customer_id: string | null = null;
  let dealer_id: string | null = null;
  let coil_id: string | null = null;
  const qr_token = typeof payload["qr_token"] === "string" ? payload["qr_token"] : null;

  if (phone) {
    const { customer } = await upsertSiteCustomer({
      phone,
      first_name: payload["first_name"] as string,
      last_name: payload["last_name"] as string,
      country: payload["country"] as string,
      website_user_id: payload["user_id"] as string,
      registration_source: "order_request",
      qr_token: qr_token || undefined,
    });
    customer_id = customer.id;
    dealer_id = customer.assigned_dealer_id;
    if (qr_token && !dealer_id) {
      const a = await tryAssignDealerFromQr(customer_id, qr_token);
      if (a.assigned) dealer_id = (await pool.query(`SELECT assigned_dealer_id FROM site_customers WHERE id = $1`, [customer_id])).rows[0]?.assigned_dealer_id;
    }
  }

  if (qr_token) {
    const coil = await getCoilByToken(qr_token);
    if (coil) {
      coil_id = coil.id;
      dealer_id = dealer_id || coil.company_id;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO site_requests (
      customer_id, dealer_id, qr_token, coil_id, first_name, last_name, phone, country,
      items, comment, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      customer_id,
      dealer_id,
      qr_token,
      coil_id,
      payload["first_name"] || null,
      payload["last_name"] || null,
      phone || null,
      payload["country"] || null,
      JSON.stringify(payload["items"] || payload["products"] || []),
      payload["comment"] || payload["message"] || null,
      payload["source"] || "website",
    ],
  );

  await kv.set(`notification:${Date.now()}`, {
    type: "site_request",
    requestId: rows[0]?.id,
    dealerId: dealer_id,
    createdAt: new Date().toISOString(),
  });

  return rows[0];
}

export async function createSiteReview(payload: SiteEventPayload) {
  const pool = getPool();
  const qr_token = typeof payload["qr_token"] === "string" ? payload["qr_token"] : null;
  let coil_id: string | null = null;
  let dealer_id: string | null = null;
  let article: string | null = null;
  let color_name: string | null = null;
  let profile_name: string | null = null;
  let customer_id: string | null = null;

  if (qr_token) {
    const coil = await getCoilByToken(qr_token);
    if (coil) {
      coil_id = coil.id;
      dealer_id = coil.company_id;
      article = coil.article;
      color_name = coil.color_name;
      profile_name = coil.profile_name;
    }
  }

  const phone = typeof payload["phone"] === "string" ? payload["phone"] : "";
  if (phone) {
    const { customer } = await upsertSiteCustomer({
      phone,
      first_name: payload["first_name"] as string,
      last_name: payload["last_name"] as string,
      country: payload["country"] as string,
      website_user_id: payload["user_id"] as string,
      registration_source: "review",
      qr_token: qr_token || undefined,
    });
    customer_id = customer.id;
    if (qr_token) await tryAssignDealerFromQr(customer_id, qr_token);
  }

  const { rows } = await pool.query(
    `INSERT INTO site_reviews (
      customer_id, coil_id, qr_token, dealer_id, rating, text, photos, article, color_name, profile_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      customer_id,
      coil_id,
      qr_token,
      dealer_id,
      Number(payload["rating"] ?? payload["score"] ?? 0) || null,
      payload["text"] || payload["review"] || null,
      JSON.stringify(payload["photos"] || []),
      article,
      color_name,
      profile_name,
    ],
  );

  await kv.set(`notification:${Date.now()}`, {
    type: "site_review",
    reviewId: rows[0]?.id,
    dealerId: dealer_id,
    createdAt: new Date().toISOString(),
  });

  return rows[0];
}

export async function processSiteEvent(
  event: string,
  payload: SiteEventPayload,
  meta: { ip?: string; user_agent?: string; event_id?: string },
) {
  const inserted = await insertSiteEvent({
    event_id: meta.event_id,
    event_type: event,
    payload,
    ip: meta.ip,
    user_agent: meta.user_agent,
  });
  if (inserted.duplicate) return { handled: true, duplicate: true };

  const qr_token = typeof payload["qr_token"] === "string" ? payload["qr_token"] : undefined;

  switch (event) {
    case "qr_scanned":
      if (qr_token) await recordCoilScan(qr_token);
      return { handled: true };

    case "registration_completed":
    case "registration_started": {
      const phone = String(payload["phone"] ?? "");
      if (!phone) return { handled: false, error: "phone required" };
      const { customer, created } = await upsertSiteCustomer({
        phone,
        first_name: payload["first_name"] as string,
        last_name: payload["last_name"] as string,
        country: payload["country"] as string,
        website_user_id: payload["user_id"] as string,
        registration_source: payload["registration_source"] as string,
        qr_token,
      });
      if (qr_token && event === "registration_completed") {
        await tryAssignDealerFromQr(customer.id, qr_token);
      }
      if (created && qr_token) {
        await kv.set(`notification:${Date.now()}`, {
          type: "qr_registration",
          customerId: customer.id,
          qr_token,
          createdAt: new Date().toISOString(),
        });
      }
      return { handled: true, customerId: customer.id };
    }

    case "order_request_created":
      await createSiteRequest(payload);
      return { handled: true };

    case "review_submitted":
      await createSiteReview(payload);
      return { handled: true };

    default:
      return { handled: true, logged: true };
  }
}
