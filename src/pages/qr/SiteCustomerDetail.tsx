import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { crm } from "../../lib/crmClient.ts";
import { siteEventLabel } from "../../lib/siteEventLabels.ts";
import { BttCrmModuleShell } from "../../components/btt-ref/BttCrmModuleShell.tsx";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ArrowLeft, UserPlus, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner@2.0.3";

type CustomerDetail = {
  customer: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
};

export default function SiteCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isDealer = location.pathname.startsWith("/dealer");
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [converting, setConverting] = useState(false);
  const [deals, setDeals] = useState<Array<{ id: string; title: string }>>([]);
  const [linkDealId, setLinkDealId] = useState("");
  const [linking, setLinking] = useState(false);

  const reload = () => {
    if (!id) return;
    const path = isDealer ? `/dealer/customers/${id}` : `/site-customers/${id}`;
    return crmFetch(path).then(async (res) => {
      if (res.ok) setData(await res.json());
    });
  };

  useEffect(() => {
    if (!id) return;
    const path = isDealer ? `/dealer/customers/${id}` : `/site-customers/${id}`;
    crmFetch(path)
      .then(async (res) => {
        if (res.ok) setData(await res.json());
        else toast.error("Клиент не найден");
      })
      .catch(() => toast.error("Ошибка загрузки"));
  }, [id, isDealer]);

  useEffect(() => {
    if (isDealer || !id) return;
    crm
      .from("deals")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error || !data) return;
        setDeals(
          data.map((d: { id: string; title: string }) => ({
            id: d.id,
            title: d.title || d.id.slice(0, 8),
          })),
        );
      });
  }, [id, isDealer]);

  const convertToContact = async () => {
    if (!id) return;
    setConverting(true);
    try {
      const res = await crmFetch(`/site-customers/${id}/convert-to-contact`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      toast.success(body.created ? "Контакт и сделка созданы в CRM" : "Уже было создано ранее");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать контакт");
    } finally {
      setConverting(false);
    }
  };

  const linkToDeal = async () => {
    if (!id || !linkDealId) return;
    setLinking(true);
    try {
      const res = await crmFetch(`/site-customers/${id}/link-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: linkDealId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      toast.success("Сделка привязана");
      setLinkDealId("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось привязать сделку");
    } finally {
      setLinking(false);
    }
  };

  const c = data?.customer;
  const backTo = isDealer ? "/dealer/customers" : "/qr";
  const backLabel = isDealer ? "К списку клиентов" : "К QR-разделу";

  const shell = (children: React.ReactNode) =>
    isDealer ? (
      <div className="space-y-4">{children}</div>
    ) : (
      <BttCrmModuleShell tag="QR" title="Клиент сайта" subtitle="Карточка из QR-сканирования">
        {children}
      </BttCrmModuleShell>
    );

  if (!c) {
    return shell(<p className="text-sm text-neutral-500">Загрузка…</p>);
  }

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Без имени";

  return shell(
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button asChild variant="outline" size="sm">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {backLabel}
          </Link>
        </Button>
        {!isDealer && !c.crm_contact_id && (
          <Button size="sm" onClick={() => void convertToContact()} disabled={converting}>
            <UserPlus className="h-4 w-4 mr-1" />
            {converting ? "Создание…" : "Создать контакт в CRM"}
          </Button>
        )}
        {!isDealer && c.crm_contact_id && (
          <Button asChild variant="secondary" size="sm">
            <Link to="/database">
              <ExternalLink className="h-4 w-4 mr-1" /> Открыть в базе
            </Link>
          </Button>
        )}
        {!isDealer && c.deal_id && (
          <Button asChild variant="outline" size="sm">
            <Link to="/deals">
              <ExternalLink className="h-4 w-4 mr-1" />{" "}
              {(c as { deal_title?: string }).deal_title || "Сделка в CRM"}
            </Link>
          </Button>
        )}
        {isDealer && c.deal_id && (
          <Badge variant="secondary" className="self-center">
            Сделка: {(c as { deal_title?: string }).deal_title || String(c.deal_id).slice(0, 8)}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border bg-white p-4 space-y-2">
          <h2 className="text-lg font-bold">{name}</h2>
          <div>
            <span className="text-neutral-500">Телефон:</span>{" "}
            <span className="font-mono">{String(c.phone_normalized || "—")}</span>
          </div>
          <div>
            <span className="text-neutral-500">Страна:</span> {String(c.country || "—")}
          </div>
          <div>
            <span className="text-neutral-500">Статус:</span>{" "}
            <Badge variant="secondary">{String(c.assignment_status || "—")}</Badge>
          </div>
          <div>
            <span className="text-neutral-500">Источник:</span> {String(c.latest_source || c.first_source || "—")}
          </div>
          <div>
            <span className="text-neutral-500">QR-токен:</span>{" "}
            <code className="text-xs">{String(c.source_qr_token || "—")}</code>
          </div>
          {!isDealer && (
            <>
              <div>
                <span className="text-neutral-500">Дилер:</span>{" "}
                {String((c as { assigned_dealer_name?: string }).assigned_dealer_name || c.assigned_dealer_id || "—")}
              </div>
              <div>
                <span className="text-neutral-500">Сделка:</span>{" "}
                {c.deal_id
                  ? String((c as { deal_title?: string }).deal_title || c.deal_id)
                  : "—"}
              </div>
            </>
          )}
          {isDealer && c.deal_id && (
            <div>
              <span className="text-neutral-500">Сделка:</span>{" "}
              {String((c as { deal_title?: string }).deal_title || c.deal_id)}
            </div>
          )}
          <div>
            <span className="text-neutral-500">Первый визит:</span>{" "}
            {c.first_seen_at ? new Date(String(c.first_seen_at)).toLocaleString("ru") : "—"}
          </div>
          <div>
            <span className="text-neutral-500">Последняя активность:</span>{" "}
            {c.last_activity_at ? new Date(String(c.last_activity_at)).toLocaleString("ru") : "—"}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h3 className="font-semibold mb-3">События на сайте</h3>
          {data?.events?.length ? (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {data.events.map((ev) => (
                <li key={String(ev.id)} className="text-xs border-b pb-2">
                  <div className="font-medium">{siteEventLabel(String(ev.event_type))}</div>
                  <div className="text-neutral-500">
                    {ev.created_at ? new Date(String(ev.created_at)).toLocaleString("ru") : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-500 text-sm">Событий пока нет</p>
          )}
        </div>
      </div>

      {!isDealer && !c.deal_id && deals.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 mt-4">
          <h3 className="font-semibold mb-3">Привязать к сделке</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={linkDealId} onValueChange={setLinkDealId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Выберите сделку" />
              </SelectTrigger>
              <SelectContent>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void linkToDeal()} disabled={!linkDealId || linking}>
              <Link2 className="h-4 w-4 mr-1" />
              {linking ? "Привязка…" : "Привязать"}
            </Button>
          </div>
        </div>
      )}

      {!isDealer && data?.assignments && data.assignments.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 mt-4">
          <h3 className="font-semibold mb-3">История закрепления за дилером</h3>
          <ul className="space-y-2 text-sm">
            {data.assignments.map((a) => (
              <li key={String(a.id)} className="flex justify-between gap-2 border-b pb-2">
                <span>{String(a.dealer_name || a.dealer_id)}</span>
                <span className="text-neutral-500 text-xs">
                  {a.assigned_at ? new Date(String(a.assigned_at)).toLocaleString("ru") : ""} · {String(a.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>,
  );
}
