import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { DEALER_SHIPMENT_STATUS_LABELS } from "../../lib/dealerOrderStages.ts";
import { DealerStageBadge } from "../../components/dealer/DealerOrderUi.tsx";
import { Badge } from "../../components/ui/badge";

type ShipmentRow = {
  id: string;
  date: string;
  status: string;
  note: string;
  deal_id: string | null;
  deal_title: string | null;
  items: Array<{ article: string; weight: number; coils?: number }>;
  items_count: number;
  total_weight: number;
};

export default function DealerShipments() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/shipments")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Отгрузки</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Все отгрузки, привязанные к вашим заказам — включая черновики до печати QR.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">
          Отгрузок пока нет. Они появятся после создания отгрузки в CRM с вашей компанией как дилером.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-white p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant={s.status === "completed" ? "default" : "secondary"}>
                    {DEALER_SHIPMENT_STATUS_LABELS[s.status] || s.status}
                  </Badge>
                  {s.status === "draft" && <DealerStageBadge stage="picking" />}
                  {s.status === "completed" && <DealerStageBadge stage="shipped" />}
                </div>
                <span className="text-neutral-500 text-xs">
                  {s.date ? new Date(s.date).toLocaleString("ru") : ""}
                </span>
              </div>

              {s.deal_id && (
                <div className="mb-2">
                  <Link
                    to={`/dealer/orders/${s.deal_id}`}
                    className="text-emerald-700 hover:underline font-medium"
                  >
                    Заказ: {s.deal_title || s.deal_id.slice(0, 8)}
                  </Link>
                </div>
              )}

              <div className="text-neutral-600 mb-2">
                {s.items_count} поз. · {s.total_weight} кг
              </div>

              {s.note && <p className="text-neutral-600 mb-2">{s.note}</p>}

              <ul className="text-xs text-neutral-500 space-y-1 border-t pt-2">
                {(s.items || []).map((i) => (
                  <li key={`${s.id}-${i.article}`}>
                    <span className="font-medium text-neutral-700">{i.article}</span> — {i.weight} кг
                    {i.coils ? ` · ${i.coils} мот.` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
