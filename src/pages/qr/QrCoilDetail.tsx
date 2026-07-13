import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BttCrmModuleShell } from '../../components/btt-ref/BttCrmModuleShell.tsx';
import { crmFetch } from '../../lib/crmApi.ts';
import { qrUrlsForToken } from '../../lib/qrUrls.ts';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export default function QrCoilDetail() {
  const { id } = useParams<{ id: string }>();
  const [coil, setCoil] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    crmFetch(`/coils/${id}`)
      .then(async (res) => {
        if (res.ok) setCoil(await res.json());
        else toast.error('Моток не найден');
      })
      .catch(() => toast.error('Ошибка загрузки'));
  }, [id]);

  if (!coil) {
    return (
      <BttCrmModuleShell tag="QR" title="Моток" subtitle="Загрузка…">
        <p className="text-sm text-neutral-500">Загрузка карточки мотка…</p>
      </BttCrmModuleShell>
    );
  }

  const urls = coil.urls || qrUrlsForToken(coil.qr_token);

  return (
    <BttCrmModuleShell
      tag="QR"
      title={coil.public_code}
      subtitle={`${coil.article} · ${coil.weight_kg} кг`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/qr"><ArrowLeft className="h-4 w-4 mr-1" /> К списку</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={urls.review} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Отзыв
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={urls.catalog} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Каталог
            </a>
          </Button>
        </div>
      }
    >
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2 rounded-2xl border p-4 bg-white">
          <div><span className="text-neutral-500">Токен:</span> <code>{coil.qr_token}</code></div>
          <div><span className="text-neutral-500">Статус:</span> <Badge>{coil.qr_status}</Badge></div>
          <div><span className="text-neutral-500">Печатей:</span> {coil.qr_print_count}</div>
          <div><span className="text-neutral-500">Сканирований:</span> {coil.scan_count}</div>
          <div><span className="text-neutral-500">Цвет:</span> {coil.color_name || '—'}</div>
          <div><span className="text-neutral-500">Профиль:</span> {coil.profile_name || '—'}</div>
        </div>
        <div className="space-y-2 rounded-2xl border p-4 bg-white">
          <div><span className="text-neutral-500">QR отзыв:</span>{' '}
            <a className="text-emerald-700 underline break-all" href={urls.review} target="_blank" rel="noreferrer">{urls.review}</a>
          </div>
          <div><span className="text-neutral-500">QR каталог:</span>{' '}
            <a className="text-emerald-700 underline break-all" href={urls.catalog} target="_blank" rel="noreferrer">{urls.catalog}</a>
          </div>
          <div><span className="text-neutral-500">Отгрузка:</span> {coil.shipment_id || '—'}</div>
          <div><span className="text-neutral-500">Заказ:</span> {coil.deal_id || '—'}</div>
          <div><span className="text-neutral-500">Дилер ID:</span> {coil.company_id || '—'}</div>
          <div><span className="text-neutral-500">Страна:</span> {coil.destination_country || '—'}</div>
          <div><span className="text-neutral-500">Отгружен:</span> {coil.shipped_at ? new Date(coil.shipped_at).toLocaleString('ru') : '—'}</div>
          <div><span className="text-neutral-500">Первое сканирование:</span> {coil.first_scanned_at ? new Date(coil.first_scanned_at).toLocaleString('ru') : '—'}</div>
        </div>
      </div>
    </BttCrmModuleShell>
  );
}
