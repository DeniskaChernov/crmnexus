import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function DealerCustomers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/customers")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Клиенты с QR</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Клиенты, закреплённые за вами после сканирования QR-кода на мотке.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">
          Пока нет клиентов. Они появятся после сканирования QR на ваших отгрузках.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Страна</TableHead>
                <TableHead>Статус</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.phone_normalized || "—"}</TableCell>
                    <TableCell>{c.country || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.assignment_status || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-neutral-500">
                      {c.last_activity_at ? new Date(c.last_activity_at).toLocaleString("ru") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/dealer/customers/${c.id}`}>Открыть</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
