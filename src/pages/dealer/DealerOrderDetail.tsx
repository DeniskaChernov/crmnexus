import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import {
  DEALER_DEAL_STATUS_LABELS,
  DEALER_SHIPMENT_STATUS_LABELS,
  dealerItemStageLabel,
} from "../../lib/dealerOrderStages.ts";
import {
  DealerOrderProgress,
  DealerStageBadge,
  DealerStagePipeline,
} from "../../components/dealer/DealerOrderUi.tsx";
import { ArrowLeft, Package, Truck } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

type OrderDetail = {
  id: string;
  title: string | null;
  client_name: string | null;
  amount: number;
  status: string;
  stage_name: string | null;
  created_at: string;
  updated_at: string;
  progress_pct: number;
  current_stage: string;
  items: Array<{
    article: string;
    type: string;
    type_label: string;
    ordered_qty: number;
    shipped_qty: number;
    draft_qty: number;
    remaining_qty: number;
    coil_count: number;
    scan_count: number;
    stage: string;
    production_status: string | null;
  }>;
  shipments: Array<{
    id: string;
    date: string;
    status: string;
    note: string;
    items: Array<{ article: string; weight: number; coils?: number }>;
  }>;
  timeline: Array<{ at: string; label: string; kind: string }>;
};

export default function DealerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    crmFetch(`/dealer/orders/${id}`)
      .then(async (res) => {
        if (res.ok) setOrder(await res.json());
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-neutral-500">Загрузка…</p>;
  if (!order) return <p className="text-sm text-red-600">Заказ не найден</p>;

  return (
    <div className="space-y-5">
      <Button asChild variant="outline" size="sm">
        <Link to="/dealer/orders">
          <ArrowLeft className="h-4 w-4 mr-1" /> К списку заказов
        </Link>
      </Button>

      <div className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{order.title || "Заказ"}</h1>
            <p className="text-sm text-neutral-500 mt-1">{order.client_name || "Клиент не указан"}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {new Intl.NumberFormat("ru-RU").format(order.amount)} сум
            </div>
            <div className="text-xs text-neutral-500">
              Создан {new Date(order.created_at).toLocaleString("ru")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{DEALER_DEAL_STATUS_LABELS[order.status] || order.status}</Badge>
          {order.stage_name && <Badge variant="secondary">Этап CRM: {order.stage_name}</Badge>}
          <DealerStageBadge stage={order.current_stage} />
        </div>

        <DealerOrderProgress pct={order.progress_pct} />

        <div>
          <div className="text-xs font-medium text-neutral-500 mb-2">Движение заказа</div>
          <DealerStagePipeline currentStage={order.current_stage} />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Package className="h-4 w-4" />
          Артикулы и этапы
        </h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-neutral-500">Позиции в заказе ещё не добавлены в CRM.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="pb-2 pr-3">Артикул</th>
                  <th className="pb-2 pr-3">Тип</th>
                  <th className="pb-2 pr-3">Заказано</th>
                  <th className="pb-2 pr-3">Отгружено</th>
                  <th className="pb-2 pr-3">Остаток</th>
                  <th className="pb-2 pr-3">QR</th>
                  <th className="pb-2">Этап</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.article} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium">{item.article}</td>
                    <td className="py-3 pr-3 text-neutral-600">{item.type_label}</td>
                    <td className="py-3 pr-3">{item.ordered_qty} кг</td>
                    <td className="py-3 pr-3">{item.shipped_qty} кг</td>
                    <td className="py-3 pr-3">{item.remaining_qty} кг</td>
                    <td className="py-3 pr-3 text-xs text-neutral-500">
                      {item.coil_count > 0 ? (
                        <>
                          {item.coil_count} мот.
                          {item.scan_count > 0 ? ` · ${item.scan_count} скан.` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3">
                      <DealerStageBadge stage={item.stage} />
                      {item.production_status && item.type === "production" && (
                        <div className="text-[10px] text-neutral-400 mt-1">
                          Произв.: {item.production_status}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Truck className="h-4 w-4" />
          Отгрузки по заказу
        </h2>
        {order.shipments.length === 0 ? (
          <p className="text-sm text-neutral-500">Отгрузок по этому заказу пока нет.</p>
        ) : (
          <ul className="space-y-3">
            {order.shipments.map((s) => (
              <li key={s.id} className="rounded-xl border p-3 text-sm">
                <div className="flex justify-between gap-2 mb-2">
                  <Badge variant={s.status === "completed" ? "default" : "secondary"}>
                    {DEALER_SHIPMENT_STATUS_LABELS[s.status] || s.status}
                  </Badge>
                  <span className="text-neutral-500 text-xs">
                    {s.date ? new Date(s.date).toLocaleString("ru") : ""}
                  </span>
                </div>
                {s.note && <p className="text-neutral-600 mb-2">{s.note}</p>}
                <ul className="text-xs text-neutral-600 space-y-1">
                  {(s.items || []).map((i) => (
                    <li key={`${s.id}-${i.article}`}>
                      {i.article} — {i.weight} кг
                      {i.coils ? ` · ${i.coils} мот.` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {order.timeline.length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold mb-4">Хронология</h2>
          <ul className="space-y-3">
            {order.timeline.map((ev, idx) => (
              <li key={`${ev.kind}-${idx}`} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <div>
                  <div>{ev.label}</div>
                  <div className="text-xs text-neutral-500">
                    {ev.at ? new Date(ev.at).toLocaleString("ru") : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
