import type pg from "pg";
import * as kv from "../kv_store.ts";
import { getPool } from "../dbPool.ts";
import { generateQrToken, nextPublicCode } from "./tokens.ts";

export type CoilRow = {
  id: string;
  public_code: string;
  qr_token: string;
  qr_status: string;
  qr_created_at: string;
  qr_printed_at: string | null;
  qr_print_count: number;
  first_scanned_at: string | null;
  last_scanned_at: string | null;
  scan_count: number;
  shipment_id: string | null;
  shipment_item_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  article: string;
  sticker_article: string | null;
  profile_name: string | null;
  color_name: string | null;
  weight_kg: string | number | null;
  coil_index: number;
  destination_country: string | null;
  shipped_at: string | null;
};

type ShipmentItem = {
  id: string;
  article: string;
  weight: number;
  coils?: number;
  date?: string;
  stickerArticle?: string;
  coilIds?: string[];
};

async function recipeMeta(article: string) {
  try {
    const recipes = await kv.getByPrefix("recipe:");
    const match = (recipes || []).find(
      (r: { name?: string; id?: string; dye?: string | { name?: string } }) =>
        r.name === article || r.id === article,
    );
    if (!match) return { profile_name: article, color_name: null as string | null };
    const dye = match.dye;
    const color_name =
      typeof dye === "string" ? dye : dye && typeof dye === "object" ? dye.name ?? null : null;
    return { profile_name: match.name || article, color_name };
  } catch {
    return { profile_name: article, color_name: null as string | null };
  }
}

async function resolveDealerCompanyId(
  pool: pg.Pool,
  shipment: { dealId?: string | null; stickerClient?: string; companyId?: string | null },
): Promise<string | null> {
  if (shipment.companyId) return shipment.companyId;
  if (shipment.dealId) {
    const { rows } = await pool.query<{ company_id: string | null }>(
      `SELECT company_id FROM deals WHERE id = $1 LIMIT 1`,
      [shipment.dealId],
    );
    if (rows[0]?.company_id) return rows[0].company_id;
  }
  const name = shipment.stickerClient?.trim();
  if (name) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM companies WHERE name ILIKE $1 LIMIT 1`,
      [name],
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

async function dealerCountry(pool: pg.Pool, companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const { rows } = await pool.query<{ country: string | null }>(
    `SELECT country FROM companies WHERE id = $1`,
    [companyId],
  );
  return rows[0]?.country ?? null;
}

async function uniqueToken(pool: pg.Pool): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const token = generateQrToken();
    const { rows } = await pool.query(`SELECT 1 FROM rattan_coils WHERE qr_token = $1`, [token]);
    if (rows.length === 0) return token;
  }
  throw new Error("Failed to generate unique qr_token");
}

export async function getCoilsByShipment(shipmentId: string): Promise<CoilRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(
    `SELECT * FROM rattan_coils WHERE shipment_id = $1 ORDER BY shipment_item_id, coil_index`,
    [shipmentId],
  );
  return rows;
}

export async function getCoilById(id: string): Promise<CoilRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(`SELECT * FROM rattan_coils WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getCoilByToken(token: string): Promise<CoilRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(
    `SELECT * FROM rattan_coils WHERE qr_token = $1 AND qr_status IN ('active', 'printed')`,
    [token],
  );
  return rows[0] ?? null;
}

export async function listCoils(opts: {
  shipment_id?: string;
  company_id?: string;
  limit?: number;
}): Promise<CoilRow[]> {
  const pool = getPool();
  const limit = Math.min(opts.limit ?? 200, 500);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.shipment_id) {
    params.push(opts.shipment_id);
    clauses.push(`shipment_id = $${params.length}`);
  }
  if (opts.company_id) {
    params.push(opts.company_id);
    clauses.push(`company_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const { rows } = await pool.query<CoilRow>(
    `SELECT * FROM rattan_coils ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function generateCoilsForShipment(opts: {
  shipmentId: string;
  itemId?: string;
}): Promise<{ coils: CoilRow[]; created: number }> {
  const shipment = await kv.get(opts.shipmentId);
  if (!shipment) throw new Error("Shipment not found");

  const pool = getPool();
  const companyId = await resolveDealerCompanyId(pool, shipment);
  const destCountry = companyId ? await dealerCountry(pool, companyId) : null;
  const dealId = shipment.dealId || null;
  const shippedAt = shipment.date || new Date().toISOString();

  const items: ShipmentItem[] = (shipment.items || []).filter((it: ShipmentItem) =>
    opts.itemId ? it.id === opts.itemId : true,
  );
  if (items.length === 0) throw new Error("No shipment items to process");

  const createdCoils: CoilRow[] = [];
  let created = 0;

  for (const item of items) {
    const existing = await pool.query<CoilRow>(
      `SELECT * FROM rattan_coils WHERE shipment_id = $1 AND shipment_item_id = $2 ORDER BY coil_index`,
      [opts.shipmentId, item.id],
    );
    if (existing.rows.length > 0) {
      createdCoils.push(...existing.rows);
      continue;
    }

    const coilCount = Math.max(1, item.coils || 1);
    const weightPerCoil = Number(item.weight) / coilCount;
    const meta = await recipeMeta(item.article);
    const coilIds: string[] = [];

    for (let idx = 1; idx <= coilCount; idx++) {
      const qr_token = await uniqueToken(pool);
      const public_code = await nextPublicCode(pool);
      const { rows } = await pool.query<CoilRow>(
        `INSERT INTO rattan_coils (
          public_code, qr_token, shipment_id, shipment_item_id, deal_id, company_id,
          article, sticker_article, profile_name, color_name, weight_kg, coil_index,
          destination_country, shipped_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          public_code,
          qr_token,
          opts.shipmentId,
          item.id,
          dealId,
          companyId,
          item.article,
          item.stickerArticle || null,
          meta.profile_name,
          meta.color_name,
          weightPerCoil,
          idx,
          destCountry,
          shippedAt,
        ],
      );
      createdCoils.push(rows[0]!);
      coilIds.push(rows[0]!.id);
      created++;
    }

    item.coilIds = coilIds;
  }

  const updatedItems = (shipment.items || []).map((it: ShipmentItem) => {
    const match = items.find((x) => x.id === it.id);
    return match ? { ...it, coilIds: match.coilIds } : it;
  });
  await kv.set(opts.shipmentId, { ...shipment, items: updatedItems });

  return { coils: createdCoils, created };
}

export async function markCoilPrinted(id: string): Promise<CoilRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(
    `UPDATE rattan_coils SET
      qr_printed_at = COALESCE(qr_printed_at, now()),
      qr_print_count = qr_print_count + 1,
      qr_status = CASE WHEN qr_status = 'active' THEN 'printed' ELSE qr_status END,
      updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deactivateCoil(id: string): Promise<CoilRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(
    `UPDATE rattan_coils SET qr_status = 'deactivated', updated_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function recordCoilScan(token: string): Promise<CoilRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<CoilRow>(
    `UPDATE rattan_coils SET
      scan_count = scan_count + 1,
      first_scanned_at = COALESCE(first_scanned_at, now()),
      last_scanned_at = now(),
      updated_at = now()
     WHERE qr_token = $1 AND qr_status IN ('active', 'printed')
     RETURNING *`,
    [token],
  );
  return rows[0] ?? null;
}

export async function qrAnalyticsSummary() {
  const pool = getPool();
  const { rows } = await pool.query<{
    total_coils: number;
    printed: number;
    total_scans: number;
    unique_scanned: number;
    customers: number;
    requests: number;
    reviews: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM rattan_coils) AS total_coils,
      (SELECT COUNT(*)::int FROM rattan_coils WHERE qr_print_count > 0) AS printed,
      (SELECT COALESCE(SUM(scan_count), 0)::int FROM rattan_coils) AS total_scans,
      (SELECT COUNT(*)::int FROM rattan_coils WHERE scan_count > 0) AS unique_scanned,
      (SELECT COUNT(*)::int FROM site_customers) AS customers,
      (SELECT COUNT(*)::int FROM site_requests) AS requests,
      (SELECT COUNT(*)::int FROM site_reviews) AS reviews
  `);
  return rows[0];
}
