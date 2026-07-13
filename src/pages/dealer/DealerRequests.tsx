import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner@2.0.3";

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Завершена",
  cancelled: "Отменена",
};

export default function DealerRequests() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    crmFetch("/dealer/requests")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const res = await crmFetch(`/dealer/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Статус обновлён");
      load();
    } else {
      toast.error("Не удалось обновить статус");
    }
  };

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
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div className="font-medium">
                  {r.first_name} {r.last_name} · {r.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{STATUS_LABELS[r.status] || r.status}</Badge>
                  <Select value={r.status || "new"} onValueChange={(v) => void updateStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
