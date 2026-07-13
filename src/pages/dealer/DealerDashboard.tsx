import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";
import { Users, Scan, Package, MessageSquare, Star } from "lucide-react";

type DashboardData = {
  company: { name: string; country?: string; city?: string };
  stats: {
    coils_total: number;
    coils_scanned: number;
    scan_total: number;
    customers: number;
    requests: number;
    reviews: number;
  };
};

export default function DealerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/dashboard")
      .then(async (res) => {
        if (res.ok) setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Загрузка…</p>;
  if (!data) return <p className="text-sm text-red-600">Не удалось загрузить данные</p>;

  const cards = [
    { label: "Клиенты (QR)", value: data.stats.customers, icon: Users },
    { label: "Сканирований QR", value: data.stats.scan_total, icon: Scan },
    { label: "Мотков с QR", value: data.stats.coils_total, icon: Package },
    { label: "Заявки с сайта", value: data.stats.requests, icon: MessageSquare },
    { label: "Отзывы", value: data.stats.reviews, icon: Star },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-5">
        <h1 className="text-2xl font-bold">{data.company.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {[data.company.city, data.company.country].filter(Boolean).join(" · ") || "Дилер BTT Nexus"}
        </p>
        <p className="text-sm text-neutral-600 mt-3">
          Здесь отображаются клиенты, которые отсканировали QR на ваших мотках и перешли на сайт.
          Карточки клиентов дублируются в основной CRM — у производителя полный доступ.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-2">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div className="text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600">
        Уникальных мотков со сканами: <strong>{data.stats.coils_scanned}</strong> из{" "}
        <strong>{data.stats.coils_total}</strong>
      </div>
    </div>
  );
}
