import type { Hono } from "hono";
import { getPool } from "../dbPool.ts";
import * as kv from "../kv_store.ts";
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUserById,
} from "../authAdmin.ts";
import {
  getRequestAuth,
  isAdminRole,
  isDealer,
  requireDealer,
} from "../middleware/requestAuth.ts";
import { getCoilsByShipment, listCoils } from "../qr/coilsService.ts";
import { listDealerNotifications } from "../qr/notificationHelper.ts";

async function requireAdminAuth(c: Parameters<typeof getRequestAuth>[0]) {
  const auth = await getRequestAuth(c);
  if (!auth) return { ok: false as const, response: c.json({ error: "Unauthorized" }, 401) };
  if (!isAdminRole(auth)) return { ok: false as const, response: c.json({ error: "Forbidden" }, 403) };
  return { ok: true as const, auth };
}

export function registerDealerRoutes(app: Hono) {
  /** Дашборд дилера: сканы, клиенты, заявки, мотки */
  app.get("/api/dealer/dashboard", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const companyId = auth.company_id!;
    const pool = getPool();

    const { rows: companyRows } = await pool.query(
      `SELECT id, name, country, city, phone, telegram, whatsapp, customer_type, dealer_portal_enabled
       FROM companies WHERE id = $1`,
      [companyId],
    );
    const company = companyRows[0];
    if (!company) return c.json({ error: "Dealer company not found" }, 404);

    const { rows: stats } = await pool.query<{
      coils_total: number;
      coils_scanned: number;
      scan_total: number;
      customers: number;
      requests: number;
      reviews: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM rattan_coils WHERE company_id = $1) AS coils_total,
        (SELECT COUNT(*)::int FROM rattan_coils WHERE company_id = $1 AND scan_count > 0) AS coils_scanned,
        (SELECT COALESCE(SUM(scan_count), 0)::int FROM rattan_coils WHERE company_id = $1) AS scan_total,
        (SELECT COUNT(*)::int FROM site_customers WHERE assigned_dealer_id = $1) AS customers,
        (SELECT COUNT(*)::int FROM site_requests WHERE dealer_id = $1) AS requests,
        (SELECT COUNT(*)::int FROM site_reviews WHERE dealer_id = $1) AS reviews`,
      [companyId],
    );

    return c.json({ company, stats: stats[0] });
  });

  app.get("/api/dealer/customers", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM site_customers
       WHERE assigned_dealer_id = $1 OR source_dealer_id = $1
       ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
       LIMIT 200`,
      [auth.company_id],
    );
    return c.json(rows);
  });

  app.get("/api/dealer/customers/:id", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const id = c.req.param("id");
    const { rows: cust } = await pool.query(
      `SELECT * FROM site_customers
       WHERE id = $1 AND (assigned_dealer_id = $2 OR source_dealer_id = $2)`,
      [id, auth.company_id],
    );
    if (!cust[0]) return c.json({ error: "Not found" }, 404);
    const { rows: events } = await pool.query(
      `SELECT * FROM site_events WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [id],
    );
    return c.json({ customer: cust[0], events });
  });

  app.get("/api/dealer/requests", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM site_requests WHERE dealer_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [auth.company_id],
    );
    return c.json(rows);
  });

  /** Лента активности дилера: заявки, отзывы, новые клиенты */
  app.get("/api/dealer/feed", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const companyId = auth.company_id!;

    const { rows: requests } = await pool.query(
      `SELECT id, 'request' AS kind, first_name, last_name, phone, comment, status, created_at
       FROM site_requests WHERE dealer_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [companyId],
    );
    const { rows: reviews } = await pool.query(
      `SELECT id, 'review' AS kind, rating, text, moderation_status, created_at
       FROM site_reviews WHERE dealer_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [companyId],
    );
    const { rows: customers } = await pool.query(
      `SELECT id, 'customer' AS kind, first_name, last_name, phone_normalized AS phone, assignment_status, created_at
       FROM site_customers
       WHERE assigned_dealer_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [companyId],
    );

    const items = [...requests, ...reviews, ...customers]
      .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, 15);

    return c.json({ items });
  });

  app.get("/api/dealer/reviews", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM site_reviews WHERE dealer_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [auth.company_id],
    );
    return c.json(rows);
  });

  app.patch("/api/dealer/requests/:id", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const status = String(body.status || "").trim();
    if (!["new", "in_progress", "done", "cancelled"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE site_requests SET status = $3
       WHERE id = $1 AND dealer_id = $2
       RETURNING *`,
      [c.req.param("id"), auth.company_id, status],
    );
    if (!rows[0]) return c.json({ error: "Not found" }, 404);
    return c.json(rows[0]);
  });

  app.get("/api/dealer/notifications", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const items = await listDealerNotifications(auth.company_id!);
    return c.json(items);
  });

  app.put("/api/dealer/notifications/:id/read", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const id = c.req.param("id");
    const notification = await kv.get(id);
    if (!notification || notification.dealerId !== auth.company_id) {
      return c.json({ error: "Not found" }, 404);
    }
    const updated = { ...notification, isRead: true };
    await kv.set(id, updated);
    return c.json({ success: true, notification: updated });
  });

  app.put("/api/dealer/notifications/read-all", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const items = await listDealerNotifications(auth.company_id!, 200);
    for (const n of items) {
      if (!n.isRead) await kv.set(n.id, { ...n, isRead: true });
    }
    return c.json({ success: true, count: items.length });
  });

  app.get("/api/dealer/coils", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const coils = await listCoils({ company_id: auth.company_id!, limit: 200 });
    return c.json(coils);
  });

  app.get("/api/dealer/shipments", async (c) => {
    const auth = await getRequestAuth(c);
    if (!requireDealer(auth)) return c.json({ error: "Forbidden" }, 403);
    const pool = getPool();
    const { rows: coilRows } = await pool.query<{ shipment_id: string }>(
      `SELECT DISTINCT shipment_id FROM rattan_coils
       WHERE company_id = $1 AND shipment_id IS NOT NULL
       ORDER BY shipment_id DESC LIMIT 100`,
      [auth.company_id],
    );
    const shipments = [];
    for (const row of coilRows) {
      if (!row.shipment_id) continue;
      const sh = await kv.get(row.shipment_id);
      if (sh) shipments.push(sh);
    }
    return c.json(shipments);
  });

  /** Admin: список аккаунтов дилера для компании */
  app.get("/api/companies/:companyId/dealer-access", async (c) => {
    const guard = await requireAdminAuth(c);
    if (!guard.ok) return guard.response;
    const pool = getPool();
    const companyId = c.req.param("companyId");
    const { rows: company } = await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId]);
    if (!company[0]) return c.json({ error: "Not found" }, 404);
    const { rows: users } = await pool.query(
      `SELECT id, email, name, role, company_id, created_at FROM crm_users
       WHERE company_id = $1 AND role = 'dealer' ORDER BY created_at DESC`,
      [companyId],
    );
    return c.json({ company: company[0], users });
  });

  /** Admin: выдать доступ дилеру (создать логин) */
  app.post("/api/companies/:companyId/dealer-access", async (c) => {
    const guard = await requireAdminAuth(c);
    if (!guard.ok) return guard.response;
    const companyId = c.req.param("companyId");
    const body = await c.req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || body.email || "").trim();
    if (!email || !password) return c.json({ error: "email and password required" }, 400);

    const pool = getPool();
    const { rows: company } = await pool.query(`SELECT id, name FROM companies WHERE id = $1`, [companyId]);
    if (!company[0]) return c.json({ error: "Company not found" }, 404);

    await pool.query(
      `UPDATE companies SET customer_type = 'dealer', dealer_portal_enabled = true WHERE id = $1`,
      [companyId],
    );

    const { rows: existing } = await pool.query<{ id: string }>(
      `SELECT id FROM crm_users WHERE lower(email) = lower($1)`,
      [email],
    );

    let userId: string;
    if (existing[0]) {
      await adminUpdateUserById(existing[0].id, {
        password,
        user_metadata: { name, role: "dealer", company_id: companyId },
      });
      userId = existing[0].id;
    } else {
      const created = await adminCreateUser({
        email,
        password,
        user_metadata: { name, role: "dealer", company_id: companyId },
        email_confirm: true,
      });
      if (created.error || !created.data?.user) {
        return c.json({ error: created.error?.message || "Failed to create user" }, 400);
      }
      userId = created.data.user.id;
    }

    await kv.set(`user:${userId}`, {
      id: userId,
      name,
      email,
      role: "dealer",
      company_id: companyId,
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, userId, companyId });
  });

  /** Admin: отозвать доступ дилера */
  app.delete("/api/companies/:companyId/dealer-access/:userId", async (c) => {
    const guard = await requireAdminAuth(c);
    if (!guard.ok) return guard.response;
    const companyId = c.req.param("companyId");
    const userId = c.req.param("userId");
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id FROM crm_users WHERE id = $1 AND company_id = $2 AND role = 'dealer'`,
      [userId, companyId],
    );
    if (!rows[0]) return c.json({ error: "Dealer user not found" }, 404);

    await adminDeleteUser(userId);
    await kv.del(`user:${userId}`);

    const { rows: left } = await pool.query(
      `SELECT 1 FROM crm_users WHERE company_id = $1 AND role = 'dealer' LIMIT 1`,
      [companyId],
    );
    if (left.length === 0) {
      await pool.query(`UPDATE companies SET dealer_portal_enabled = false WHERE id = $1`, [companyId]);
    }

    return c.json({ success: true });
  });
}
