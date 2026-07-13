import { getPool } from "../dbPool.ts";
import * as kv from "../kv_store.ts";
import type { DealerItemStage } from "../../lib/dealerOrderStages.ts";
import { dealerItemStageIndex } from "../../lib/dealerOrderStages.ts";

type DealRow = {
  id: string;
  title: string | null;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  stage_id: string | null;
  stage_name: string | null;
  stage_order: number | null;
  client_name: string | null;
};

type DealItem = {
  article: string;
  quantity: number;
  price?: number;
  warehouse?: string;
  type?: "stock" | "production";
};

type ShipmentDoc = {
  id: string;
  date?: string;
  status?: string;
  dealId?: string | null;
  companyId?: string | null;
  note?: string;
  items?: Array<{ id?: string; article: string; weight?: number; coils?: number }>;
  createdAt?: string;
};

type ProdEvent = {
  id: string;
  recipeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

type CoilRow = {
  article: string;
  deal_id: string | null;
  shipment_id: string | null;
  scan_count: number;
  weight_kg: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeArticle(article: string): string {
  return article.trim().toLowerCase();
}

function computeItemStage(opts: {
  item: DealItem;
  dealStatus: string;
  stageOrder: number | null;
  orderedQty: number;
  shippedQty: number;
  draftQty: number;
  coilCount: number;
  scanCount: number;
  productionStatus: string | null;
}): DealerItemStage {
  const { orderedQty, shippedQty, draftQty, coilCount, scanCount, productionStatus } = opts;

  if (scanCount > 0) return "scanned";
  if (coilCount > 0) return "with_qr";
  if (orderedQty > 0 && shippedQty >= orderedQty) return "shipped";
  if (shippedQty > 0) return "partially_shipped";
  if (draftQty > 0) return "picking";

  const isProduction = opts.item.type === "production";
  if (isProduction) {
    if (productionStatus === "in_progress" || productionStatus === "planned") return "in_production";
    if (productionStatus === "completed") return "ready_to_ship";
    return "in_production";
  }

  if (opts.dealStatus === "won") return "ready_to_ship";
  if ((opts.stageOrder ?? 1) > 1 || opts.dealStatus === "open") return "crm_processing";
  return "ordered";
}

async function loadDealerContext(companyId: string) {
  const pool = getPool();

  const { rows: deals } = await pool.query<DealRow>(
    `SELECT d.id, d.title, d.amount, d.status, d.created_at, d.updated_at, d.stage_id,
            s.name AS stage_name, s.order_index AS stage_order,
            c.name AS client_name
     FROM deals d
     LEFT JOIN stages s ON s.id = d.stage_id
     LEFT JOIN companies c ON c.id = d.company_id
     WHERE d.dealer_id = $1
     ORDER BY d.updated_at DESC
     LIMIT 200`,
    [companyId],
  );

  const dealIds = deals.map((d) => d.id);

  const [allShipments, prodEvents, prodOrders] = await Promise.all([
    kv.getByPrefix("shipment:") as Promise<ShipmentDoc[]>,
    kv.getByPrefix("production_event:") as Promise<ProdEvent[]>,
    dealIds.length > 0
      ? kv.mget(dealIds.map((id) => `prod-order:${id}`))
      : Promise.resolve([]),
  ]);

  const dealerShipments = allShipments.filter(
    (s) => s && (s.companyId === companyId || (s.dealId && dealIds.includes(s.dealId))),
  );

  const dealItemsMap = new Map<string, DealItem[]>();
  if (dealIds.length > 0) {
    const itemsArr = await kv.mget(dealIds.map((id) => `deal_items:${id}`));
    dealIds.forEach((id, i) => {
      const raw = itemsArr[i];
      dealItemsMap.set(id, Array.isArray(raw) ? (raw as DealItem[]) : []);
    });
  }

  let coils: CoilRow[] = [];
  if (dealIds.length > 0) {
    const { rows } = await pool.query<CoilRow>(
      `SELECT article, deal_id, shipment_id, scan_count, weight_kg
       FROM rattan_coils
       WHERE company_id = $1 AND (deal_id = ANY($2::uuid[]) OR deal_id IS NULL)`,
      [companyId, dealIds],
    );
    coils = rows;
  } else {
    const { rows } = await pool.query<CoilRow>(
      `SELECT article, deal_id, shipment_id, scan_count, weight_kg
       FROM rattan_coils WHERE company_id = $1`,
      [companyId],
    );
    coils = rows;
  }

  const prodOrderByDeal = new Map<string, { status?: string }>();
  dealIds.forEach((id, i) => {
    const o = prodOrders[i];
    if (o && typeof o === "object") prodOrderByDeal.set(id, o as { status?: string });
  });

  const prodEventByArticle = new Map<string, string>();
  for (const ev of prodEvents) {
    if (!ev?.recipeId) continue;
    const key = normalizeArticle(ev.recipeId);
    const prev = prodEventByArticle.get(key);
    const rank = (s: string) =>
      s === "in_progress" ? 3 : s === "planned" ? 2 : s === "issue" ? 1 : s === "completed" ? 0 : 0;
    const next = ev.status || "planned";
    if (!prev || rank(next) > rank(prev)) prodEventByArticle.set(key, next);
  }

  return { deals, dealItemsMap, dealerShipments, coils, prodOrderByDeal, prodEventByArticle };
}

function aggregateShipped(
  shipments: ShipmentDoc[],
  dealId: string,
): { shipped: Map<string, number>; draft: Map<string, number> } {
  const shipped = new Map<string, number>();
  const draft = new Map<string, number>();
  for (const s of shipments) {
    if (s.dealId !== dealId) continue;
    const target = s.status === "completed" ? shipped : draft;
    for (const item of s.items || []) {
      if (!item.article) continue;
      const key = normalizeArticle(item.article);
      target.set(key, (target.get(key) || 0) + num(item.weight));
    }
  }
  return { shipped, draft };
}

function aggregateCoils(coils: CoilRow[], dealId: string) {
  const byArticle = new Map<string, { count: number; scans: number; weight: number }>();
  for (const c of coils) {
    if (c.deal_id && c.deal_id !== dealId) continue;
    const key = normalizeArticle(c.article);
    const cur = byArticle.get(key) || { count: 0, scans: 0, weight: 0 };
    cur.count += 1;
    cur.scans += num(c.scan_count);
    cur.weight += num(c.weight_kg);
    byArticle.set(key, cur);
  }
  return byArticle;
}

function buildOrderDetail(
  deal: DealRow,
  ctx: Awaited<ReturnType<typeof loadDealerContext>>,
) {
  const items = ctx.dealItemsMap.get(deal.id) || [];
  const { shipped, draft } = aggregateShipped(ctx.dealerShipments, deal.id);
  const coilMap = aggregateCoils(ctx.coils, deal.id);
  const prodOrder = ctx.prodOrderByDeal.get(deal.id);

  const orderShipments = ctx.dealerShipments
    .filter((s) => s.dealId === deal.id)
    .map((s) => ({
      id: s.id,
      date: s.date || s.createdAt,
      status: s.status || "draft",
      note: s.note || "",
      items: (s.items || []).map((i) => ({
        article: i.article,
        weight: num(i.weight),
        coils: i.coils,
      })),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const itemRows = items
    .filter((i) => i.article)
    .map((item) => {
      const key = normalizeArticle(item.article);
      const orderedQty = num(item.quantity);
      const shippedQty = shipped.get(key) || 0;
      const draftQty = draft.get(key) || 0;
      const coilInfo = coilMap.get(key) || { count: 0, scans: 0, weight: 0 };
      const productionStatus =
        ctx.prodEventByArticle.get(key) || prodOrder?.status || null;

      const stage = computeItemStage({
        item,
        dealStatus: deal.status,
        stageOrder: deal.stage_order,
        orderedQty,
        shippedQty,
        draftQty,
        coilCount: coilInfo.count,
        scanCount: coilInfo.scans,
        productionStatus,
      });

      return {
        article: item.article,
        type: item.type || "stock",
        type_label: item.type === "production" ? "На заказ" : "Со склада",
        ordered_qty: orderedQty,
        shipped_qty: shippedQty,
        draft_qty: draftQty,
        remaining_qty: Math.max(0, orderedQty - shippedQty),
        coil_count: coilInfo.count,
        scan_count: coilInfo.scans,
        stage,
        production_status: productionStatus,
      };
    });

  const totalOrdered = itemRows.reduce((s, i) => s + i.ordered_qty, 0);
  const totalShipped = itemRows.reduce((s, i) => s + i.shipped_qty, 0);
  const progress_pct = totalOrdered > 0 ? Math.min(100, Math.round((totalShipped / totalOrdered) * 100)) : 0;

  let current_stage: DealerItemStage = "ordered";
  for (const row of itemRows) {
    if (dealerItemStageIndex(row.stage) > dealerItemStageIndex(current_stage)) {
      current_stage = row.stage;
    }
  }
  if (itemRows.length === 0) {
    if (deal.status === "won") current_stage = "ready_to_ship";
    else if (deal.status === "lost") current_stage = "ordered";
    else current_stage = "crm_processing";
  }

  const timeline: Array<{ at: string; label: string; kind: string }> = [
    { at: deal.created_at, label: "Заказ создан в CRM", kind: "deal_created" },
  ];
  if (deal.stage_name) {
    timeline.push({
      at: deal.updated_at,
      label: `Этап CRM: ${deal.stage_name}`,
      kind: "crm_stage",
    });
  }
  for (const s of orderShipments) {
    timeline.push({
      at: String(s.date),
      label: s.status === "completed" ? "Отгрузка завершена" : "Начата комплектация",
      kind: "shipment",
    });
  }
  timeline.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    id: deal.id,
    title: deal.title,
    client_name: deal.client_name,
    amount: num(deal.amount),
    status: deal.status,
    stage_name: deal.stage_name,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
    progress_pct,
    current_stage,
    items: itemRows,
    shipments: orderShipments,
    timeline,
    items_count: itemRows.length,
    shipments_count: orderShipments.length,
  };
}

export async function listDealerOrders(companyId: string) {
  const ctx = await loadDealerContext(companyId);
  return ctx.deals.map((deal) => {
    const detail = buildOrderDetail(deal, ctx);
    return {
      id: detail.id,
      title: detail.title,
      client_name: detail.client_name,
      amount: detail.amount,
      status: detail.status,
      stage_name: detail.stage_name,
      created_at: detail.created_at,
      updated_at: detail.updated_at,
      progress_pct: detail.progress_pct,
      current_stage: detail.current_stage,
      items_count: detail.items_count,
      shipments_count: detail.shipments_count,
    };
  });
}

export async function getDealerOrder(companyId: string, dealId: string) {
  const ctx = await loadDealerContext(companyId);
  const deal = ctx.deals.find((d) => d.id === dealId);
  if (!deal) return null;
  return buildOrderDetail(deal, ctx);
}

export async function listDealerShipmentsEnriched(companyId: string) {
  const ctx = await loadDealerContext(companyId);
  const dealTitleMap = new Map(ctx.deals.map((d) => [d.id, d.title]));

  return ctx.dealerShipments
    .map((s) => ({
      id: s.id,
      date: s.date || s.createdAt,
      status: s.status || "draft",
      note: s.note || "",
      deal_id: s.dealId || null,
      deal_title: s.dealId ? dealTitleMap.get(s.dealId) || null : null,
      items: (s.items || []).map((i) => ({
        article: i.article,
        weight: num(i.weight),
        coils: i.coils,
      })),
      items_count: (s.items || []).length,
      total_weight: (s.items || []).reduce((sum, i) => sum + num(i.weight), 0),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
