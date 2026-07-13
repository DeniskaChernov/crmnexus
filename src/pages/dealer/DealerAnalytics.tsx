import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { dealerItemStageLabel } from "../../lib/dealerOrderStages.ts";
import { DealerOrderProgress } from "../../components/dealer/DealerOrderUi.tsx";
import { BarChart3, Scan, Users, ClipboardList, Star, MessageSquare, Package } from "lucide-react";

type Stats = {
  orders: number;
  orders_in_progress: number;
  customers: number;
  requests: number;
  reviews: number;
  coils_total: number;
  coils_scanned: number;
  scan_total: number;
};

type OrderRow = {
  id: string;
  title: string | null;
  progress_pct: number;
  current_stage: string;
};

type AnalyticsPayload = {
  stats: Stats;
  orders_by_stage: Record<string, number>;
  requests_by_status: Record<string, number>;
  avg_rating: number | null;
  scan_rate_pct: number;
  top_articles: Array<{ article: string; coils: number; scans: number }>;
};

export default function DealerAnalytics() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      crmFetch("/dealer/analytics").then(async (res) => {
        if (res.ok) setData(await res.json());
      }),
      crmFetch("/dealer/orders").then(async (res) => {
        if (res.ok) setOrders(await res.json());
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const stageRows = useMemo(() => {
    if (!data?.orders_by_stage) return [];
    return Object.entries(data.orders_by_stage)
      .map(([stage, count]) => ({ stage, count, label: dealerItemStageLabel(stage) }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (loading) return <p className="text-sm text-neutral-500">Загрузка…</p>;
  if (!data) return <p className="text-sm text-red-600">Не удалось загрузить аналитику</p>;

  const s = data.stats;

  const kpi = [
    { label: "Заказов", value: s.orders, icon: ClipboardList, href: "/dealer/orders" },
    { label: "В работе", value: s.orders_in_progress, icon: BarChart3, href: "/dealer/orders" },
    { label: "Клиентов QR", value: s.customers, icon: Users, href: "/dealer/customers" },
    { label: "Заявок", value: s.requests, icon: MessageSquare, href: "/dealer/requests" },
    { label: "Отзывов", value: s.reviews, icon: Star, href: "/dealer/reviews" },
    { label: "Сканов QR", value: s.scan_total, icon: Scan, href: "/dealer/coils" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Аналитика
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Сводка по заказам, клиентам с QR и активности на сайте.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpi.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            to={href}
            className="rounded-2xl border bg-white p-4 hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="text-2xl font-bold">{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold mb-3">QR и мотки</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Мотков с QR</span>
              <span className="font-medium">{s.coils_total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Мотков со сканами</span>
              <span className="font-medium">{s.coils_scanned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Конверсия сканов</span>
              <span className="font-medium">{data.scan_rate_pct}%</span>
            </div>
            {data.avg_rating != null && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Средняя оценка</span>
                <span className="font-medium">★ {data.avg_rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Заказы по этапам</h2>
          {stageRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет активных заказов</p>
          ) : (
            <ul className="space-y-2">
              {stageRows.map((r) => (
                <li key={r.stage} className="flex justify-between text-sm gap-2">
                  <span className="text-neutral-700">{r.label}</span>
                  <span className="font-semibold tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data.top_articles.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Топ артикулов (мотки / сканы)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="pb-2">Артикул</th>
                  <th className="pb-2 text-right">Мотков</th>
                  <th className="pb-2 text-right">Сканов</th>
                </tr>
              </thead>
              <tbody>
                {data.top_articles.map((a) => (
                  <tr key={a.article} className="border-b last:border-0">
                    <td className="py-2 font-medium">{a.article}</td>
                    <td className="py-2 text-right">{a.coils}</td>
                    <td className="py-2 text-right">{a.scans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Прогресс заказов</h2>
          <ul className="space-y-3">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link to={`/dealer/orders/${o.id}`} className="block hover:opacity-80">
                  <div className="flex justify-between text-sm mb-1 gap-2">
                    <span className="font-medium truncate">{o.title || "Заказ"}</span>
                    <span className="text-neutral-500 shrink-0">{dealerItemStageLabel(o.current_stage)}</span>
                  </div>
                  <DealerOrderProgress pct={o.progress_pct} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
