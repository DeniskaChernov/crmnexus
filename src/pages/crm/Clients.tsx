import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useChunkedList } from '../../hooks/useChunkedList';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '../../components/ui/sheet';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Trash2,
  Pencil,
  User,
  ShoppingBag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  TrendingUp,
  Banknote,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useIsMobile } from '../../components/ui/use-mobile';
import { clientInitials, formatUZS, parseAmount } from '../../lib/formatMoney.ts';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  company_id: string;
  createdAt: string;
}

interface Deal {
  id: string;
  title: string;
  amount: number | string;
  status: 'open' | 'won' | 'lost';
  created_at: string;
  company_id?: string;
  contact_id?: string;
}

type SortField = 'name' | 'orders' | 'ltv';
type SortDirection = 'asc' | 'desc' | null;

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
      }`}
    >
      {label}
      {active ? (
        direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
      )}
    </button>
  );
}

function ClientAvatar({ name }: { name: string }) {
  const initials = clientInitials(name);
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 92%), hsl(${hue} 55% 85%))`,
        color: `hsl(${hue} 45% 32%)`,
      }}
    >
      {initials}
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const isMobile = useIsMobile();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: companiesData, error: companiesError } = await crm
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (companiesError) throw companiesError;

      const { data: contactsData, error: contactsError } = await crm
        .from('contacts')
        .select('id, company_id');
      if (contactsError) throw contactsError;

      const { data: dealsData, error: dealsError } = await crm
        .from('deals')
        .select('id, title, amount, status, created_at, company_id, contact_id');
      if (dealsError) throw dealsError;

      if (companiesData) {
        setClients(
          companiesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            notes: c.notes || '',
            company_id: c.id,
            createdAt: c.created_at,
          })),
        );
      }
      if (contactsData) setContacts(contactsData);
      if (dealsData) setDeals(dealsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Не удалось загрузить список клиентов');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Имя клиента обязательно');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
      };

      const { error } = editingClient
        ? await crm.from('companies').update(payload).eq('id', editingClient.id)
        : await crm.from('companies').insert(payload);

      if (error) throw error;

      toast.success(editingClient ? 'Клиент обновлён' : 'Клиент создан');
      setIsAddOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при сохранении');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены? Удалятся также все сделки этого клиента.')) return;

    try {
      const { error } = await crm.from('companies').delete().eq('id', id);
      if (error) throw error;

      toast.success('Клиент удалён');
      setClients(clients.filter((c) => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при удалении');
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email,
      notes: client.notes,
    });
    setIsAddOpen(true);
  };

  const openAdd = () => {
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', notes: '' });
    setIsAddOpen(true);
  };

  const getClientDeals = useCallback(
    (client: Client) => {
      const companyContactIds = contacts
        .filter((contact) => contact.company_id === client.company_id)
        .map((contact) => contact.id);

      return deals.filter(
        (deal) =>
          deal.company_id === client.company_id ||
          (deal.contact_id && companyContactIds.includes(deal.contact_id)),
      );
    },
    [contacts, deals],
  );

  const getClientStats = useCallback(
    (client: Client) => {
      const clientDeals = getClientDeals(client);
      const wonDeals = clientDeals.filter((d) => d.status === 'won');
      const totalSpent = wonDeals.reduce((sum, d) => sum + parseAmount(d.amount), 0);
      const lastOrder =
        wonDeals.length > 0
          ? new Date(Math.max(...wonDeals.map((d) => new Date(d.created_at).getTime())))
          : null;
      const winRate = clientDeals.length > 0 ? Math.round((wonDeals.length / clientDeals.length) * 100) : 0;

      return {
        totalDeals: clientDeals.length,
        wonDeals: wonDeals.length,
        ltv: totalSpent,
        lastOrder,
        winRate,
      };
    },
    [getClientDeals],
  );

  const sortedClients = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const filtered = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)),
        )
      : clients;

    const arr = [...filtered];
    if (!sortField || !sortDirection) return arr;

    arr.sort((a, b) => {
      if (sortField === 'name') {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortField === 'orders') {
        const aStats = getClientStats(a);
        const bStats = getClientStats(b);
        return sortDirection === 'asc' ? aStats.wonDeals - bStats.wonDeals : bStats.wonDeals - aStats.wonDeals;
      }
      if (sortField === 'ltv') {
        const aStats = getClientStats(a);
        const bStats = getClientStats(b);
        return sortDirection === 'asc' ? aStats.ltv - bStats.ltv : bStats.ltv - aStats.ltv;
      }
      return 0;
    });
    return arr;
  }, [clients, deferredSearch, sortField, sortDirection, getClientStats]);

  const summary = useMemo(() => {
    let totalLtv = 0;
    let totalWon = 0;
    let totalDeals = 0;
    for (const client of sortedClients) {
      const s = getClientStats(client);
      totalLtv += s.ltv;
      totalWon += s.wonDeals;
      totalDeals += s.totalDeals;
    }
    return { count: sortedClients.length, totalLtv, totalWon, totalDeals };
  }, [sortedClients, getClientStats]);

  const chunkResetKey = `${deferredSearch}|${sortField}|${sortDirection}`;
  const { visibleItems: visibleClients, sentinelRef, hasMore, visibleCount, total: clientsTotal } =
    useChunkedList(sortedClients, chunkResetKey, 28);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderClientRow = (client: Client) => {
    const stats = getClientStats(client);

    return (
      <div
        key={client.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedClient(client)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedClient(client)}
        className="group grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_140px_88px] gap-3 md:gap-4 items-center px-4 md:px-5 py-4 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ClientAvatar name={client.name} />
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 truncate">{client.name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-neutral-500">
              {client.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 shrink-0" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                  <Mail className="w-3 h-3 shrink-0" />
                  {client.email}
                </span>
              )}
              {!client.phone && !client.email && <span>Контакты не указаны</span>}
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>Успешных сделок</span>
            <span className="font-medium text-neutral-700">
              {stats.wonDeals} / {stats.totalDeals}
            </span>
          </div>
          <Progress value={stats.winRate} className="h-1.5 bg-neutral-100" />
        </div>

        <div className="md:hidden flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">
            {stats.wonDeals} / {stats.totalDeals}
          </Badge>
          <span className="text-xs text-neutral-400">сделок</span>
        </div>

        <div className="text-left md:text-right">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium mb-0.5">LTV</p>
          <p className="font-bold text-emerald-700 tabular-nums text-sm md:text-base whitespace-nowrap">
            {formatUZS(stats.ltv, isMobile)}
          </p>
        </div>

        <div className="flex md:justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
            onClick={() => openEdit(client)}
            aria-label="Редактировать"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => handleDelete(client.id)}
            aria-label="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Панель действий */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Поиск по имени, телефону, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white border-neutral-200 rounded-[1.75rem] shadow-sm focus-visible:ring-neutral-300"
          />
        </div>
        <Button onClick={openAdd} className="h-11 rounded-[1.75rem] bg-neutral-900 hover:bg-neutral-800 shadow-sm shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Добавить клиента
        </Button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Клиентов', value: summary.count.toString(), icon: Users, tone: 'text-neutral-900' },
          { label: 'Всего сделок', value: summary.totalDeals.toString(), icon: ShoppingBag, tone: 'text-neutral-900' },
          { label: 'Успешных', value: summary.totalWon.toString(), icon: TrendingUp, tone: 'text-emerald-700' },
          { label: 'Суммарный LTV', value: formatUZS(summary.totalLtv, true), icon: Banknote, tone: 'text-emerald-700' },
        ].map((item) => (
          <Card key={item.label} className="tasklab-card overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[1.75rem] bg-neutral-100 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-neutral-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500 font-medium">{item.label}</p>
                <p className={`text-lg font-bold truncate tabular-nums ${item.tone}`}>{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Список */}
      <div className="tasklab-card overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_140px_88px] gap-4 px-5 py-3 bg-neutral-50/80 border-b border-neutral-100">
          <SortButton label="Клиент" active={sortField === 'name'} direction={sortDirection} onClick={() => handleSort('name')} />
          <SortButton label="Сделки" active={sortField === 'orders'} direction={sortDirection} onClick={() => handleSort('orders')} />
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Конверсия</span>
          <SortButton label="LTV" active={sortField === 'ltv'} direction={sortDirection} onClick={() => handleSort('ltv')} />
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 text-right">Действия</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            <span className="text-sm">Загрузка клиентов…</span>
          </div>
        ) : sortedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-[1.75rem] bg-neutral-100 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-neutral-400" />
            </div>
            <p className="font-medium text-neutral-900">Клиенты не найдены</p>
            <p className="text-sm text-neutral-500 mt-1 max-w-sm">
              {search ? 'Попробуйте другой запрос или очистите поиск' : 'Добавьте первого клиента, чтобы начать работу'}
            </p>
            {!search && (
              <Button onClick={openAdd} className="mt-4 rounded-[1.75rem]" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Добавить клиента
              </Button>
            )}
          </div>
        ) : (
          <div>{visibleClients.map(renderClientRow)}</div>
        )}

        {!loading && clientsTotal > 0 && (
          <div className="px-4 pb-3 text-center border-t border-neutral-50">
            <div ref={sentinelRef} className="h-3 w-full" aria-hidden />
            {hasMore && (
              <p className="text-xs text-neutral-400 pt-2">
                Показано {visibleCount} из {clientsTotal}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="tasklab-card rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Редактировать клиента' : 'Новый клиент'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Измените данные клиента' : 'Заполните информацию о новом клиенте'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Имя (как в сделках)</Label>
              <Input
                placeholder="Например: ООО Ромашка"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                placeholder="+998…"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="rounded-[1.75rem] bg-neutral-900 hover:bg-neutral-800">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent className="w-full sm:max-w-[720px] overflow-y-auto p-0">
          {selectedClient &&
            (() => {
              const stats = getClientStats(selectedClient);
              const clientDeals = [...getClientDeals(selectedClient)].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              );

              return (
                <div className="flex flex-col min-h-full bg-neutral-50">
                  <SheetHeader className="p-6 bg-white border-b text-left space-y-3">
                    <div className="flex items-center gap-4">
                      <ClientAvatar name={selectedClient.name} />
                      <div>
                        <SheetTitle className="text-xl">{selectedClient.name}</SheetTitle>
                        <SheetDescription>Карточка клиента</SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="tasklab-card rounded-[1.75rem] border-emerald-100 bg-emerald-50/50">
                        <CardContent className="p-4">
                          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatUZS(stats.ltv)}</p>
                          <p className="text-xs text-emerald-800/70 mt-1">LTV (всего покупок)</p>
                        </CardContent>
                      </Card>
                      <Card className="tasklab-card rounded-[1.75rem]">
                        <CardContent className="p-4">
                          <p className="text-2xl font-bold text-neutral-900">{stats.wonDeals}</p>
                          <p className="text-xs text-neutral-500 mt-1">Успешных сделок из {stats.totalDeals}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="tasklab-card p-4 space-y-2 text-sm">
                      <h3 className="font-medium flex items-center gap-2 text-neutral-900">
                        <User className="w-4 h-4" /> Контакты
                      </h3>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-500">Телефон</span>
                        <span className="font-medium">{selectedClient.phone || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-500">Email</span>
                        <span className="font-medium">{selectedClient.email || '—'}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-medium flex items-center gap-2 text-neutral-900">
                        <ShoppingBag className="w-4 h-4" /> История заказов
                      </h3>
                      {clientDeals.length === 0 ? (
                        <p className="text-sm text-neutral-500 text-center py-6 tasklab-card">
                          Нет сделок с этим клиентом
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {clientDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="tasklab-card p-3 flex justify-between items-center gap-3 hover:border-neutral-300 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-neutral-900 truncate">{deal.title}</p>
                                <p className="text-xs text-neutral-500">
                                  {new Date(deal.created_at).toLocaleDateString('ru-RU')}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-sm tabular-nums text-neutral-900">
                                  {formatUZS(deal.amount)}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={`text-xs mt-1 ${
                                    deal.status === 'won'
                                      ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                                      : deal.status === 'lost'
                                        ? 'text-red-600 border-red-200 bg-red-50'
                                        : 'text-neutral-900 border-neutral-200 bg-[var(--tasklab-lime)]/15'
                                  }`}
                                >
                                  {deal.status === 'won' ? 'Успех' : deal.status === 'lost' ? 'Проигрыш' : 'В работе'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
