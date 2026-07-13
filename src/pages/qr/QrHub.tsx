import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BttCrmModuleShell } from '../../components/btt-ref/BttCrmModuleShell.tsx';
import { crmFetch } from '../../lib/crmApi.ts';
import { qrUrlsForToken } from '../../lib/qrUrls.ts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

type Coil = {
  id: string;
  public_code: string;
  qr_token: string;
  article: string;
  weight_kg: number | string;
  scan_count: number;
  qr_print_count: number;
  qr_status: string;
  shipped_at?: string;
  url?: string;
  urls?: { main: string; review: string; catalog: string };
};

type Summary = {
  total_coils: number;
  printed: number;
  total_scans: number;
  unique_scanned: number;
  customers: number;
  requests: number;
  reviews: number;
};

export default function QrHub() {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [coilsRes, sumRes, revRes, reqRes, custRes] = await Promise.all([
        crmFetch('/coils?limit=100'),
        crmFetch('/qr-analytics/summary'),
        crmFetch('/site-reviews'),
        crmFetch('/site-requests'),
        crmFetch('/site-customers'),
      ]);
      if (coilsRes.ok) setCoils(await coilsRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (revRes.ok) setReviews(await revRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch {
      toast.error('Не удалось загрузить QR-данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const moderateReview = async (id: string, status: string) => {
    const res = await crmFetch(`/site-reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ moderation_status: status }),
    });
    if (res.ok) {
      toast.success('Статус отзыва обновлён');
      void load();
    }
  };

  return (
    <BttCrmModuleShell
      tag="QR"
      title="QR-коды"
      subtitle="Мотки ротанга, сканирования, заявки и отзывы с сайта"
    >
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            ['Мотков с QR', summary.total_coils],
            ['Напечатано', summary.printed],
            ['Сканирований', summary.total_scans],
            ['Клиентов сайта', summary.customers],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="text-2xl font-bold mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="coils">
        <TabsList>
          <TabsTrigger value="coils">Мотки</TabsTrigger>
          <TabsTrigger value="customers">Клиенты ({customers.length})</TabsTrigger>
          <TabsTrigger value="requests">Заявки ({requests.length})</TabsTrigger>
          <TabsTrigger value="reviews">Отзывы ({reviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="coils" className="mt-4">
          {loading ? (
            <p className="text-sm text-neutral-500">Загрузка…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Вес</TableHead>
                  <TableHead>Сканирования</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coils.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.public_code}</TableCell>
                    <TableCell>{c.article}</TableCell>
                    <TableCell>{c.weight_kg} кг</TableCell>
                    <TableCell>{c.scan_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.qr_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/qr/coils/${c.id}`}>
                          <QrCode className="h-4 w-4 mr-1" /> Карточка
                        </Link>
                      </Button>
                      {(() => {
                        const urls = c.urls || qrUrlsForToken(c.qr_token);
                        return (
                          <>
                            <Button asChild variant="ghost" size="sm" title="Отзыв">
                              <a href={urls.review} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button asChild variant="ghost" size="sm" title="Каталог">
                              <a href={urls.catalog} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4 rotate-90" />
                              </a>
                            </Button>
                          </>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          {loading ? (
            <p className="text-sm text-neutral-500">Загрузка…</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-neutral-500">Клиентов с QR пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Дилер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((cust) => (
                  <TableRow key={cust.id}>
                    <TableCell>
                      {[cust.first_name, cust.last_name].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cust.phone_normalized || '—'}</TableCell>
                    <TableCell className="text-sm">{cust.assigned_dealer_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{cust.assignment_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/qr/customers/${cust.id}`}>Карточка</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 bg-white text-sm">
              <div className="font-medium">{r.first_name} {r.last_name} · {r.phone}</div>
              <div className="text-neutral-500">{r.country} · {new Date(r.created_at).toLocaleString('ru')}</div>
              {r.comment && <p className="mt-2">{r.comment}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 bg-white text-sm">
              <div className="flex justify-between gap-2">
                <span>★ {r.rating}</span>
                <Badge>{r.moderation_status}</Badge>
              </div>
              <p className="mt-2">{r.text}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => moderateReview(r.id, 'approved')}>Одобрить</Button>
                <Button size="sm" variant="outline" onClick={() => moderateReview(r.id, 'rejected')}>Отклонить</Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </BttCrmModuleShell>
  );
}
