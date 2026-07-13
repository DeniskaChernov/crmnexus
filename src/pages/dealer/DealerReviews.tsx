import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";
import { Badge } from "../../components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Завершена",
  cancelled: "Отменена",
};

export default function DealerReviews() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/reviews")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Отзывы клиентов</h1>
        <p className="text-sm text-neutral-500 mt-1">Отзывы, оставленные через QR на ваших мотках.</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">Отзывов пока нет.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 text-sm">
              <div className="flex justify-between gap-2 items-start">
                <span className="font-medium">★ {r.rating}</span>
                <Badge variant="secondary">{r.moderation_status || "pending"}</Badge>
              </div>
              {r.text && <p className="mt-2">{r.text}</p>}
              <div className="text-neutral-500 text-xs mt-2">
                {[r.article, r.color_name].filter(Boolean).join(" · ")}
                {r.created_at && ` · ${new Date(r.created_at).toLocaleString("ru")}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
