import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";

export default function DealerRequests() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/requests")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Заявки с сайта</h1>
        <p className="text-sm text-neutral-500 mt-1">Запросы клиентов, пришедших через ваш QR.</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">Заявок пока нет.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 text-sm">
              <div className="font-medium">
                {r.first_name} {r.last_name} · {r.phone}
              </div>
              <div className="text-neutral-500 text-xs mt-1">
                {r.country} · {new Date(r.created_at).toLocaleString("ru")}
              </div>
              {r.comment && <p className="mt-2">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
