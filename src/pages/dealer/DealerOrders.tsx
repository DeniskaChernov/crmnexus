import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { DEALER_DEAL_STATUS_LABELS } from "../../lib/dealerOrderStages.ts";
import { DealerOrderProgress, DealerStageBadge } from "../../components/dealer/DealerOrderUi.tsx";
import { ClipboardList, Search } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";

type OrderRow = {
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
  items_count: number;
  shipments_count: number;
};

export default function DealerOrders() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "won" | "lost">("all");

  useEffect(() => {
    crmFetch("/dealer/orders")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        (r.title || "").toLowerCase().includes(q) ||
        (r.client_name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Ваши заказы
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Сделки CRM, где вы указаны как дилер. Видны этапы заказа и статус каждого артикула.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            className="pl-8"
            placeholder="Поиск по заказу или клиенту…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "open", "won", "lost"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                filter === f ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
              }`}
            >
              {f === "all" ? "Все" : DEALER_DEAL_STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">
          Заказов пока нет. Они появятся, когда в CRM создадут сделку с вашей компанией как дилером.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Link
              key={o.id}
              to={`/dealer/orders/${o.id}`}
              className="block rounded-2xl border bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold">{o.title || "Без названия"}</div>
                  <div className="text-sm text-neutral-500">{o.client_name || "Клиент не указан"}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">
                    {new Intl.NumberFormat("ru-RU").format(o.amount)} сум
                  </div>
                  <div className="text-neutral-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString("ru")}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3 items-center">
                <Badge variant="outline">{DEALER_DEAL_STATUS_LABELS[o.status] || o.status}</Badge>
                {o.stage_name && <Badge variant="secondary">CRM: {o.stage_name}</Badge>}
                <DealerStageBadge stage={o.current_stage} />
              </div>

              <DealerOrderProgress pct={o.progress_pct} />

              <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                <span>Артикулов: {o.items_count}</span>
                <span>Отгрузок: {o.shipments_count}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
