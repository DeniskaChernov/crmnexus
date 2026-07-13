import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";

export default function DealerShipments() {
  const [rows, setRows] = useState<any[]>([]);
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
        <h1 className="text-xl font-bold">Ваши отгрузки</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Отгрузки, где в CRM указан ваш дилерский аккаунт.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">
          Отгрузок пока нет.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-white p-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{s.destination || "Отгрузка"}</span>
                <span className="text-neutral-500">
                  {s.date ? new Date(s.date).toLocaleDateString("ru") : ""}
                </span>
              </div>
              <div className="text-neutral-500 mt-1">
                {s.status === "completed" ? "Завершена" : "Черновик"} · позиций: {s.items?.length ?? 0}
              </div>
              {s.note && <p className="mt-2 text-neutral-600">{s.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
