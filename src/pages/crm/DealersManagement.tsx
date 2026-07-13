import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { crm } from "@/lib/crmClient.ts";
import { crmFetch } from "@/lib/crmApi.ts";
import { TaskLabPage } from "../../components/tasklab";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { DealerAccessDialog } from "../../components/crm/DealerAccessDialog";
import { CreateCompanyDialog } from "../../components/crm/CreateCompanyDialog";
import { KeyRound, Search, Store, ExternalLink, Power, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner@2.0.3";

type DealerRow = {
  id: string;
  name: string;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  customer_type?: string | null;
  dealer_portal_enabled?: boolean;
  dealer_users_count?: number;
  created_at?: string;
};

type CompanyOption = { id: string; name: string };

function canGrantDealerAccess(role: string): boolean {
  return ["owner", "director", "admin"].includes(role.toLowerCase());
}

export default function DealersManagement() {
  const [dealers, setDealers] = useState<DealerRow[]>([]);
  const [allCompanies, setAllCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pickCompanyId, setPickCompanyId] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [accessCompany, setAccessCompany] = useState<{ id: string; name: string } | null>(null);
  const [userRole, setUserRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mgmtRes, companiesRes] = await Promise.all([
        crmFetch("/dealer-management"),
        crm.from("companies").select("id, name, customer_type, dealer_portal_enabled").order("name"),
      ]);
      if (mgmtRes.ok) setDealers(await mgmtRes.json());
      else toast.error("Не удалось загрузить дилеров");
      if (!companiesRes.error) setAllCompanies(companiesRes.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    crm.auth.getSession().then(({ data }) => {
      const role = data.session?.user?.user_metadata?.role;
      setUserRole(typeof role === "string" ? role : "");
    });
  }, [load]);

  const canManage = canGrantDealerAccess(userRole);

  const candidates = useMemo(() => {
    const dealerIds = new Set(dealers.map((d) => d.id));
    return allCompanies.filter((c) => !dealerIds.has(c.id));
  }, [allCompanies, dealers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.city && d.city.toLowerCase().includes(q)) ||
        (d.country && d.country.toLowerCase().includes(q)),
    );
  }, [dealers, search]);

  const enablePortal = async (companyId: string) => {
    if (!canManage) {
      toast.error("Выдача доступа доступна только администратору");
      return;
    }
    setEnabling(true);
    try {
      const res = await crmFetch(`/dealer-management/${companyId}/enable`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      toast.success(`Портал включён: ${body.name}`);
      setPickCompanyId("");
      await load();
      const company = allCompanies.find((c) => c.id === companyId);
      if (company) setAccessCompany(company);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось включить портал");
    } finally {
      setEnabling(false);
    }
  };

  const disablePortal = async (dealer: DealerRow) => {
    if (!canManage) {
      toast.error("Отключение портала доступно только администратору");
      return;
    }
    if ((dealer.dealer_users_count || 0) > 0) {
      toast.error("Сначала отзовите доступ у всех аккаунтов дилера");
      return;
    }
    if (!confirm(`Отключить портал для «${dealer.name}»?`)) return;
    const res = await crmFetch(`/dealer-management/${dealer.id}/disable`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error || "Не удалось отключить портал");
      return;
    }
    toast.success("Портал отключён");
    await load();
  };

  return (
    <TaskLabPage
      tag="Дилеры"
      title="Управление дилерами"
      subtitle="Портал дилера, логины и доступ к QR-клиентам"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/qr">
              <ExternalLink className="h-4 w-4 mr-1" />
              QR-раздел
            </Link>
          </Button>
          {canManage && <CreateCompanyDialog onSuccess={load} />}
        </div>
      }
    >
      <div className="rounded-2xl border bg-emerald-50/60 p-4 mb-5 text-sm text-emerald-950">
        <p className="font-medium mb-1">Как это работает</p>
        <ul className="list-disc pl-5 space-y-1 text-emerald-900/90">
          <li>Выберите компанию и включите портал дилера.</li>
          <li>Выдайте логин — дилер входит на <code className="text-xs bg-white/70 px-1 rounded">/dealer</code>, без доступа к основной CRM.</li>
          <li>Клиенты с QR и заявки с сайта попадают в портал закреплённого дилера.</li>
        </ul>
        {!canManage && (
          <p className="mt-2 text-amber-800">
            Ваша роль: просмотр списка. Выдача и отзыв доступа — у администратора (owner / director / admin).
          </p>
        )}
      </div>

      {canManage && (
        <div className="rounded-2xl border bg-white p-4 mb-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Store className="h-4 w-4" />
            Добавить компанию как дилера
          </h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={pickCompanyId} onValueChange={setPickCompanyId}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Выберите компанию из базы" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Все компании уже в списке дилеров
                  </SelectItem>
                ) : (
                  candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              disabled={!pickCompanyId || enabling || pickCompanyId === "_none"}
              onClick={() => void enablePortal(pickCompanyId)}
            >
              {enabling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Power className="h-4 w-4 mr-1" />}
              Включить портал
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            className="pl-8"
            placeholder="Поиск по названию, городу, стране…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary">{filtered.length} дилеров</Badge>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Компания</TableHead>
              <TableHead className="hidden md:table-cell">Регион</TableHead>
              <TableHead className="hidden sm:table-cell">Портал</TableHead>
              <TableHead className="hidden sm:table-cell">Аккаунты</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-neutral-500">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-neutral-500">
                  Дилеры не настроены.{" "}
                  {canManage ? "Добавьте компанию выше или создайте новую." : "Обратитесь к администратору."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.name}</div>
                    {d.phone && <div className="text-xs text-neutral-500">{d.phone}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-neutral-600">
                    {[d.city, d.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {d.dealer_portal_enabled ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Включён</Badge>
                    ) : (
                      <Badge variant="secondary">Выключен</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{d.dealer_users_count ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage}
                        title={canManage ? "Выдать или отозвать логин" : "Только для администратора"}
                        onClick={() => setAccessCompany({ id: d.id, name: d.name })}
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Доступ
                      </Button>
                      {canManage && !d.dealer_users_count && d.dealer_portal_enabled && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => void disablePortal(d)}
                          title="Отключить портал"
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DealerAccessDialog
        company={accessCompany}
        open={Boolean(accessCompany)}
        onOpenChange={(open) => {
          if (!open) setAccessCompany(null);
        }}
        onSuccess={() => void load()}
      />
    </TaskLabPage>
  );
}
