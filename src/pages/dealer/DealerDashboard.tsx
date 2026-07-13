import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { Users, Scan, Package, MessageSquare, Star, ClipboardList, Truck } from "lucide-react";
import { DealerOrderProgress, DealerStageBadge } from "../../components/dealer/DealerOrderUi.tsx";
import { Button } from "../../components/ui/button";

type FeedItem = {
  id: string;
  kind: "request" | "review" | "customer";
  first_name?: string;
  last_name?: string;
  phone?: string;
  comment?: string;
  rating?: number;
  text?: string;
  created_at: string;
};

type DashboardData = {
  company: { name: string; country?: string; city?: string };
  stats: {
    coils_total: number;
    coils_scanned: number;
    scan_total: number;
    customers: number;
    requests: number;
    reviews: number;
    orders: number;
    orders_in_progress: number;
  };
};

type OrderPreview = {
  id: string;
  title: string | null;
  client_name: string | null;
  progress_pct: number;
  current_stage: string;
  updated_at: string;
};

export default function DealerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [orders, setOrders] = useState<OrderPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      crmFetch("/dealer/dashboard").then(async (res) => {
        if (res.ok) setData(await res.json());
      }),
      crmFetch("/dealer/feed").then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          setFeed(json.items || []);
        }
      }),
      crmFetch("/dealer/orders").then(async (res) => {
        if (res.ok) {
          const all = await res.json();
          setOrders((all as OrderPreview[]).slice(0, 5));
        }
      }),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Загрузка…</p>;
  if (!data) return <p className="text-sm text-red-600">Не удалось загрузить данные</p>;

  const cards = [
    { label: "Заказы", value: data.stats.orders, icon: ClipboardList, href: "/dealer/orders" },
    { label: "В работе", value: data.stats.orders_in_progress, icon: Truck, href: "/dealer/orders" },
    { label: "Клиенты (QR)", value: data.stats.customers, icon: Users, href: "/dealer/customers" },
    { label: "Сканирований QR", value: data.stats.scan_total, icon: Scan, href: "/dealer/coils" },
    { label: "Мотков с QR", value: data.stats.coils_total, icon: Package, href: "/dealer/coils" },
    { label: "Заявки с сайта", value: data.stats.requests, icon: MessageSquare, href: "/dealer/requests" },
    { label: "Отзывы", value: data.stats.reviews, icon: Star, href: "/dealer/reviews" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-5">
        <h1 className="text-2xl font-bold">{data.company.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {[data.company.city, data.company.country].filter(Boolean).join(" · ") || "Дилер BTT Nexus"}
        </p>
        <p className="text-sm text-neutral-600 mt-3">
          Портал показывает ваши заказы, этапы отгрузки и артикулы, клиентов с QR, заявки и отзывы с сайта.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            to={href}
            className="rounded-2xl border bg-white p-4 hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-2">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div className="text-3xl font-bold">{value}</div>
          </Link>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Активные заказы</h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/dealer/orders">Все заказы</Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/dealer/orders/${o.id}`}
                  className="block rounded-xl border p-3 hover:border-emerald-300"
                >
                  <div className="flex justify-between gap-2 mb-2">
                    <div>
                      <div className="font-medium">{o.title || "Заказ"}</div>
                      <div className="text-xs text-neutral-500">{o.client_name || "—"}</div>
                    </div>
                    <DealerStageBadge stage={o.current_stage} />
                  </div>
                  <DealerOrderProgress pct={o.progress_pct} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600">
        Уникальных мотков со сканами: <strong>{data.stats.coils_scanned}</strong> из{" "}
        <strong>{data.stats.coils_total}</strong>
      </div>

      {feed.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Последняя активность</h2>
          <ul className="space-y-2 text-sm">
            {feed.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="border-b pb-2 last:border-0">
                {item.kind === "request" && (
                  <div>
                    <span className="font-medium">Заявка:</span>{" "}
                    {[item.first_name, item.last_name].filter(Boolean).join(" ") || item.phone}
                    {item.comment && <span className="text-neutral-500"> — {item.comment.slice(0, 60)}</span>}
                  </div>
                )}
                {item.kind === "review" && (
                  <div>
                    <span className="font-medium">Отзыв ★{item.rating}:</span> {(item.text || "").slice(0, 80)}
                  </div>
                )}
                {item.kind === "customer" && (
                  <div>
                    <span className="font-medium">Новый клиент:</span>{" "}
                    <Link to={`/dealer/customers/${item.id}`} className="text-emerald-700 hover:underline">
                      {[item.first_name, item.last_name].filter(Boolean).join(" ") || item.phone}
                    </Link>
                  </div>
                )}
                <div className="text-xs text-neutral-500 mt-0.5">
                  {new Date(item.created_at).toLocaleString("ru")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
