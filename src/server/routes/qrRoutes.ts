import type { Hono } from "hono";
import { getPool } from "../dbPool.ts";
import { publicQrUrl, publicQrUrls } from "../qr/tokens.ts";
import {
  deactivateCoil,
  generateCoilsForShipment,
  getCoilById,
  getCoilByToken,
  getCoilsByShipment,
  listCoils,
  markCoilPrinted,
  qrAnalyticsSummary,
  recordCoilScan,
} from "../qr/coilsService.ts";
import { createSiteReview, insertSiteEvent } from "../qr/siteServices.ts";
import { getRequestAuth, isDealer } from "../middleware/requestAuth.ts";

function dealerForbidden(c: { json: (body: unknown, status?: number) => Response }, auth: Awaited<ReturnType<typeof getRequestAuth>>) {
  if (auth && isDealer(auth)) return c.json({ error: "Forbidden" }, 403);
  return null;
}

async function assertAdminQrAccess(c: Parameters<typeof getRequestAuth>[0]) {
  const auth = await getRequestAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const denied = dealerForbidden(c, auth);
  if (denied) return denied;
  return null;
}

/** Публичный resolve QR для сайта bententrade.uz/r/{token} */
export function registerQrPublicRoutes(app: Hono) {
  app.get("/api/public/qr/:token", async (c) => {
    try {
      const token = c.req.param("token");
      const coil = await getCoilByToken(token);
      if (!coil) return c.json({ ok: false, error: "not_found" }, 404);

      await recordCoilScan(token);
      await insertSiteEvent({
        event_type: "qr_scanned",
        payload: { qr_token: token, page_url: c.req.url },
        ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
        user_agent: c.req.header("user-agent"),
      });

      const pool = getPool();
      let dealer: Record<string, unknown> | null = null;
      if (coil.company_id) {
        const { rows } = await pool.query(
          `SELECT id, name, country, city, phone, telegram, whatsapp, type, customer_type FROM companies WHERE id = $1`,
          [coil.company_id],
        );
        dealer = rows[0] ?? null;
      }

      return c.json({
        ok: true,
        qr_token: coil.qr_token,
        public_code: coil.public_code,
        url: publicQrUrl(coil.qr_token),
        urls: publicQrUrls(coil.qr_token),
        article: coil.article,
        sticker_article: coil.sticker_article,
        profile_name: coil.profile_name,
        color_name: coil.color_name,
        weight_kg: coil.weight_kg,
        coil_index: coil.coil_index,
        destination_country: coil.destination_country,
        shipped_at: coil.shipped_at,
        dealer,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ ok: false, error: msg }, 500);
    }
  });

  app.get("/api/public/qr/:token/:purpose", async (c) => {
    try {
      const token = c.req.param("token");
      const purpose = c.req.param("purpose");
      if (!["review", "catalog"].includes(purpose)) {
        return c.json({ ok: false, error: "invalid_purpose" }, 400);
      }
      const coil = await getCoilByToken(token);
      if (!coil) return c.json({ ok: false, error: "not_found" }, 404);

      await recordCoilScan(token);
      await insertSiteEvent({
        event_type: purpose === "review" ? "review_started" : "catalog_opened",
        payload: { qr_token: token, purpose, page_url: c.req.url },
        ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
        user_agent: c.req.header("user-agent"),
      });

      const urls = publicQrUrls(coil.qr_token);
      return c.json({
        ok: true,
        purpose,
        qr_token: coil.qr_token,
        public_code: coil.public_code,
        redirect: purpose === "review" ? urls.review : urls.catalog,
        url: purpose === "review" ? urls.review : urls.catalog,
        article: coil.article,
        sticker_article: coil.sticker_article,
        profile_name: coil.profile_name,
        color_name: coil.color_name,
        weight_kg: coil.weight_kg,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ ok: false, error: msg }, 500);
    }
  });

  app.post("/api/public/qr/:token/review", async (c) => {
    try {
      const token = c.req.param("token");
      const coil = await getCoilByToken(token);
      if (!coil) return c.json({ ok: false, error: "not_found" }, 404);

      const body = await c.req.json();
      const rating = Number(body.rating ?? body.score ?? 0);
      const text = String(body.text ?? body.review ?? "").trim();
      if (!rating || rating < 1 || rating > 5) {
        return c.json({ ok: false, error: "rating_required" }, 400);
      }
      if (!text) return c.json({ ok: false, error: "text_required" }, 400);

      const review = await createSiteReview({
        qr_token: token,
        rating,
        text,
        phone: body.phone,
        first_name: body.first_name,
        last_name: body.last_name,
        country: body.country,
      });
      await insertSiteEvent({
        event_type: "review_submitted",
        payload: { qr_token: token, rating, text },
        ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
        user_agent: c.req.header("user-agent"),
      });

      return c.json({ ok: true, review });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "error";
      return c.json({ ok: false, error: msg }, 500);
    }
  });
}

/** Защищённые QR-маршруты CRM (требуют Bearer) */
export function registerQrRoutes(app: Hono) {
  app.get("/api/coils", async (c) => {
    try {
      const auth = await getRequestAuth(c);
      const denied = dealerForbidden(c, auth);
      if (denied) return denied;
      const shipment_id = c.req.query("shipment_id") || undefined;
      const company_id = c.req.query("company_id") || undefined;
      const coils = await listCoils({ shipment_id, company_id });
      return c.json(coils.map((co) => ({ ...co, url: publicQrUrl(co.qr_token), urls: publicQrUrls(co.qr_token) })));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/coils/shipment/:shipmentId", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const coils = await getCoilsByShipment(c.req.param("shipmentId"));
      return c.json(coils.map((co) => ({ ...co, url: publicQrUrl(co.qr_token), urls: publicQrUrls(co.qr_token) })));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/coils/:id", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const coil = await getCoilById(c.req.param("id"));
      if (!coil) return c.json({ error: "Not found" }, 404);
      return c.json({ ...coil, url: publicQrUrl(coil.qr_token), urls: publicQrUrls(coil.qr_token) });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.post("/api/coils/generate", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const body = await c.req.json();
      const shipmentId = String(body.shipmentId || body.shipment_id || "");
      const itemId = body.itemId || body.item_id;
      if (!shipmentId) return c.json({ error: "shipmentId required" }, 400);
      const result = await generateCoilsForShipment({ shipmentId, itemId });
      return c.json({
        success: true,
        created: result.created,
        coils: result.coils.map((co) => ({ ...co, url: publicQrUrl(co.qr_token), urls: publicQrUrls(co.qr_token) })),
      });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 400);
    }
  });

  app.post("/api/coils/:id/print", async (c) => {
    try {
      const coil = await markCoilPrinted(c.req.param("id"));
      if (!coil) return c.json({ error: "Not found" }, 404);
      return c.json({ success: true, coil: { ...coil, url: publicQrUrl(coil.qr_token), urls: publicQrUrls(coil.qr_token) } });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.post("/api/coils/:id/deactivate", async (c) => {
    try {
      const coil = await deactivateCoil(c.req.param("id"));
      if (!coil) return c.json({ error: "Not found" }, 404);
      return c.json({ success: true, coil });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/qr-analytics/summary", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const summary = await qrAnalyticsSummary();
      return c.json(summary);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/site-reviews", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const pool = getPool();
      const status = c.req.query("status");
      const params: unknown[] = [];
      let where = "";
      if (status) {
        params.push(status);
        where = `WHERE moderation_status = $1`;
      }
      const { rows } = await pool.query(
        `SELECT * FROM site_reviews ${where} ORDER BY created_at DESC LIMIT 200`,
        params,
      );
      return c.json(rows);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.put("/api/site-reviews/:id", async (c) => {
    try {
      const body = await c.req.json();
      const status = body.moderation_status || body.status;
      if (!status) return c.json({ error: "moderation_status required" }, 400);
      const pool = getPool();
      const { rows } = await pool.query(
        `UPDATE site_reviews SET moderation_status = $2 WHERE id = $1 RETURNING *`,
        [c.req.param("id"), status],
      );
      if (!rows[0]) return c.json({ error: "Not found" }, 404);
      return c.json(rows[0]);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/site-requests", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM site_requests ORDER BY created_at DESC LIMIT 200`);
      return c.json(rows);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/site-customers", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const pool = getPool();
      const dealerId = c.req.query("dealer_id");
      const params: unknown[] = [];
      let where = "";
      if (dealerId) {
        params.push(dealerId);
        where = `WHERE sc.assigned_dealer_id = $1 OR sc.source_dealer_id = $1`;
      }
      const { rows } = await pool.query(
        `SELECT sc.*,
          ad.name AS assigned_dealer_name,
          sd.name AS source_dealer_name
         FROM site_customers sc
         LEFT JOIN companies ad ON ad.id = sc.assigned_dealer_id
         LEFT JOIN companies sd ON sd.id = sc.source_dealer_id
         ${where}
         ORDER BY sc.last_activity_at DESC NULLS LAST, sc.created_at DESC
         LIMIT 300`,
        params,
      );
      return c.json(rows);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  app.get("/api/site-customers/:id", async (c) => {
    try {
      const denied = await assertAdminQrAccess(c);
      if (denied) return denied;
      const pool = getPool();
      const id = c.req.param("id");
      const { rows: cust } = await pool.query(`SELECT * FROM site_customers WHERE id = $1`, [id]);
      if (!cust[0]) return c.json({ error: "Not found" }, 404);
      const { rows: events } = await pool.query(
        `SELECT * FROM site_events WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [id],
      );
      const { rows: assignments } = await pool.query(
        `SELECT cda.*, co.name AS dealer_name
         FROM customer_dealer_assignments cda
         LEFT JOIN companies co ON co.id = cda.dealer_id
         WHERE cda.customer_id = $1
         ORDER BY cda.assigned_at DESC`,
        [id],
      );
      return c.json({ customer: cust[0], events, assignments });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : "error" }, 500);
    }
  });
}
