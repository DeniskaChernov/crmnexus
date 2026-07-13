/** Этапы артикула в заказе дилера (от приёма до скана QR) */
export type DealerItemStage =
  | "ordered"
  | "crm_processing"
  | "in_production"
  | "ready_to_ship"
  | "picking"
  | "partially_shipped"
  | "shipped"
  | "with_qr"
  | "scanned";

export const DEALER_ITEM_STAGE_LABELS: Record<DealerItemStage, string> = {
  ordered: "Заказ принят",
  crm_processing: "Согласование",
  in_production: "В производстве",
  ready_to_ship: "Готов к отгрузке",
  picking: "Комплектация",
  partially_shipped: "Частично отгружен",
  shipped: "Отгружен",
  with_qr: "QR на мотках",
  scanned: "У клиента (скан QR)",
};

export const DEALER_ITEM_STAGE_ORDER: DealerItemStage[] = [
  "ordered",
  "crm_processing",
  "in_production",
  "ready_to_ship",
  "picking",
  "partially_shipped",
  "shipped",
  "with_qr",
  "scanned",
];

export const DEALER_DEAL_STATUS_LABELS: Record<string, string> = {
  open: "В работе",
  won: "Подтверждён",
  lost: "Отменён",
};

export const DEALER_SHIPMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Комплектация",
  completed: "Отгружено",
};

export function dealerItemStageLabel(stage: string): string {
  return DEALER_ITEM_STAGE_LABELS[stage as DealerItemStage] || stage;
}

export function dealerItemStageIndex(stage: DealerItemStage): number {
  return DEALER_ITEM_STAGE_ORDER.indexOf(stage);
}

export function dealerItemStageBadgeClass(stage: DealerItemStage): string {
  switch (stage) {
    case "scanned":
      return "bg-emerald-100 text-emerald-800";
    case "with_qr":
    case "shipped":
      return "bg-blue-100 text-blue-800";
    case "partially_shipped":
    case "picking":
      return "bg-amber-100 text-amber-800";
    case "in_production":
      return "bg-orange-100 text-orange-800";
    case "ready_to_ship":
      return "bg-lime-100 text-lime-900";
    case "crm_processing":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}
