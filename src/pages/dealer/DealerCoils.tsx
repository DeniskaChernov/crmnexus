import React, { useEffect, useState } from "react";
import { crmFetch } from "../../lib/crmApi.ts";
import { qrUrlsForToken } from "../../lib/qrUrls.ts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { ExternalLink } from "lucide-react";

export default function DealerCoils() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("/dealer/coils")
      .then(async (res) => {
        if (res.ok) setRows(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Мотки и QR</h1>
        <p className="text-sm text-neutral-500 mt-1">Отгрузки, привязанные к вашей компании.</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-500 text-sm">
          Мотков пока нет. Они появятся после отгрузки с выбором вашей компании как дилера.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Вес</TableHead>
                <TableHead>Сканы</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const urls = qrUrlsForToken(c.qr_token);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.public_code}</TableCell>
                    <TableCell>{c.article}</TableCell>
                    <TableCell>{c.weight_kg} кг</TableCell>
                    <TableCell>{c.scan_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.qr_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <a href={urls.review} target="_blank" rel="noreferrer" className="inline-flex text-emerald-700">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
