import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Plus, Search, DollarSign, Calendar as CalendarIcon, MoreHorizontal, ArrowUpRight, ArrowDownLeft, Trash2, FileText, CheckCircle2, AlertCircle, ChevronDown, Download, CircleCheck } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
import { format, parseISO, isSameMonth, subMonths, isSameYear, startOfMonth, endOfMonth, startOfYear, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { CreateDealDialog } from '../../components/crm/CreateDealDialog';
import { EditDealDialog } from '../../components/crm/EditDealDialog';
import { DealCard } from '../../components/crm/DealCard';
import { DealDetailSheet } from '../../components/crm/DealDetailSheet';
import { useCrmAiClient } from '../../context/CrmAiClientContext.tsx';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { Pencil } from 'lucide-react';
import { TaskLabPage, TaskLabStat } from '../../components/tasklab';

export default function Deals() {
  const { setFocus, clearFocus } = useCrmAiClient();
  const [deals, setDeals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [excludedDealIds, setExcludedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Payment Dialog State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  
  // Edit Deal State
  const [dealToEdit, setDealToEdit] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Detail Sheet State
  const [dealToView, setDealToView] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: ''
  });
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const DEALS_BATCH_SIZE = 24;
  const [visibleDealsCount, setVisibleDealsCount] = useState(DEALS_BATCH_SIZE);
  const loadMoreDealsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dealsRes, paymentsRes, metaRes] = await Promise.all([
        crm
          .from('deals')
          .select('*, companies(name)')
          .order('created_at', { ascending: false }),
        fetch(`${crmUrl('/payments')}`, {
          headers: { ...authHeaders(false) }
        }),
        fetch(`${crmUrl('/deals/excluded')}`, {
          headers: { ...authHeaders(false) }
        }),
      ]);

      if (dealsRes.error) throw dealsRes.error;
      const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];
      const metaData = metaRes.ok ? await metaRes.json() : { excludedIds: [] };
      setExcludedDealIds(new Set(metaData.excludedIds || []));

      let dealerMap = new Map<string, string>();
      try {
        const dr = await fetch(`${crmUrl('/qr/dealers')}`, { headers: { ...authHeaders(false) } });
        if (dr.ok) {
          for (const row of await dr.json()) dealerMap.set(row.id, row.name);
        }
      } catch {
        dealerMap = new Map();
      }

      setDeals((dealsRes.data || []).map((d: { dealer_id?: string | null }) => {
        const dealer_name = d.dealer_id ? dealerMap.get(d.dealer_id) : null;
        return { ...d, dealer_name };
      }));
      setPayments(paymentsData || []);

    } catch (e) {
      console.error(e);
      toast.error("Ошибка загрузки данных");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openDealForEdit = useCallback((deal: any) => {
    setDealToEdit(deal);
    setIsEditOpen(true);
  }, []);

  const openDealForView = useCallback(
    (deal: any) => {
      setDealToView(deal);
      setIsDetailOpen(true);
      setFocus({ kind: "deal", id: String(deal.id), label: deal.title ? String(deal.title) : undefined });
    },
    [setFocus],
  );

  const openAddPaymentDialog = useCallback(
    (deal: any) => {
      setSelectedDeal(deal);
      setNewPayment({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      setIsPaymentOpen(true);
      setFocus({ kind: "deal", id: String(deal.id), label: deal.title ? String(deal.title) : undefined });
    },
    [setFocus],
  );

  const paymentStatsByDeal = useMemo(() => {
    const byDeal = new Map<string, { paidTotal: number; dealPayments: any[] }>();
    for (const p of payments) {
      const dealId = p?.dealId;
      if (!dealId) continue;
      const existing = byDeal.get(dealId);
      if (existing) {
        existing.paidTotal += Number(p.amount || 0);
        existing.dealPayments.push(p);
      } else {
        byDeal.set(dealId, { paidTotal: Number(p.amount || 0), dealPayments: [p] });
      }
    }
    return byDeal;
  }, [payments]);

  // Helper to calculate stats per deal
  const getDealStats = (deal: any) => {
    const paymentStats = paymentStatsByDeal.get(deal.id);
    const paidTotal = paymentStats?.paidTotal || 0;
    const dealPayments = paymentStats?.dealPayments || [];
    const dealTotal = deal.amount || 0;
    const balance = dealTotal - paidTotal;
    const percentage = dealTotal > 0 ? (paidTotal / dealTotal) * 100 : 0;
    return { paidTotal, balance, percentage, dealPayments };
  };

  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // 1. Search Term
      const dealTitle = deal.title?.toLowerCase() || '';
      const companyName = deal.companies?.name?.toLowerCase() || '';
      const matchesSearch = !normalizedSearch ||
        dealTitle.includes(normalizedSearch) ||
        companyName.includes(normalizedSearch);
      if (!matchesSearch) return false;

      // 2. Date Range Filter
      if (dateRange?.from) {
        const dealDate = parseISO(deal.created_at);
        const end = dateRange.to || dateRange.from;
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (!isWithinInterval(dealDate, { start: dateRange.from, end: endOfDay })) {
          return false;
        }
      }

      // 3. Status Filter
      if (filterStatus !== 'all') {
        const stats = getDealStats(deal);
        const hasDebt = stats.balance > 0;
        if (filterStatus === 'debt' && !hasDebt) return false;
        if (filterStatus === 'paid' && hasDebt) return false;
      }

      return true;
    });
  }, [deals, normalizedSearch, dateRange, filterStatus, paymentStatsByDeal]);

  useEffect(() => {
    setVisibleDealsCount(DEALS_BATCH_SIZE);
  }, [normalizedSearch, filterStatus, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  useEffect(() => {
    if (visibleDealsCount >= filteredDeals.length) return;
    const target = loadMoreDealsRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleDealsCount((prev) => Math.min(prev + DEALS_BATCH_SIZE, filteredDeals.length));
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredDeals.length, visibleDealsCount]);

  const visibleDeals = useMemo(
    () => filteredDeals.slice(0, visibleDealsCount),
    [filteredDeals, visibleDealsCount],
  );
  const hasMoreDeals = visibleDealsCount < filteredDeals.length;

  const summary = useMemo(() => {
    let expectedRevenue = 0;
    let receivedRevenue = 0;
    let debtTotal = 0;

    for (const d of filteredDeals) {
      if (excludedDealIds.has(d.id)) continue;
      const stats = getDealStats(d);
      receivedRevenue += stats.paidTotal;
      if (d.status === 'open' || d.status === 'won') {
        expectedRevenue += d.amount || 0;
      }
      if (d.status === 'won') {
        debtTotal += stats.balance;
      }
    }

    return { expectedRevenue, receivedRevenue, debtTotal };
  }, [filteredDeals, excludedDealIds, paymentStatsByDeal]);

  const handleAddPayment = async () => {
    if (!selectedDeal || !newPayment.amount) {
      toast.error("Введите сумму");
      return;
    }

    try {
      const response = await fetch(`${crmUrl('/payments')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          dealId: selectedDeal.id,
          amount: newPayment.amount,
          date: newPayment.date,
          note: newPayment.note
        })
      });

      if (!response.ok) throw new Error("Failed");

      toast.success("Оплата добавлена");
      setIsPaymentOpen(false);
      setNewPayment({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      fetchData(true); // Refresh data
    } catch (e) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Удалить запись об оплате?")) return;
    try {
      await fetch(`${crmUrl(`/payments/${id}`)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(false) }
      });
      toast.success("Удалено");
      fetchData(true);
    } catch (e) {
      toast.error("Ошибка удаления");
    }
  };

  const handleDeleteDeal = async (id: string) => {
      if (!confirm("Вы уверены, что хотите удалить сделку? Это действие нельзя отменить.")) return;
      try {
          const { error } = await crm.from('deals').delete().eq('id', id);
          if (error) throw error;
          
          toast.success("Сделка удалена");
          fetchData(true);
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при удалении сделки");
      }
  };

  const handlePayAll = async () => {
    if (!confirm("Вы действительно хотите автоматически погасить долги по ВСЕМ сделкам?")) return;
    
    // Use non-silent loading to show progress
    setLoading(true); 
    try {
        // Calculate debts based on current data
        const dealsToPay = deals.filter(d => {
             const stats = getDealStats(d);
             return stats.balance > 100; // Filter out tiny dust amounts
        });

        if (dealsToPay.length === 0) {
            toast.info("Нет сделок с задолженностью");
            setLoading(false);
            return;
        }

        const loadingToast = toast.loading(`Погашение долгов: 0/${dealsToPay.length}...`);
        
        // Process sequentially to avoid rate limits
        for (let i = 0; i < dealsToPay.length; i++) {
            const deal = dealsToPay[i];
            const stats = getDealStats(deal);
            
            try {
                await fetch(`${crmUrl('/payments')}`, {
                    method: 'POST',
                    headers: { ...authHeaders() },
                    body: JSON.stringify({
                    dealId: deal.id,
                    amount: stats.balance,
                    date: format(new Date(), 'yyyy-MM-dd'),
                    note: 'Автоматическое погашение'
                    })
                });
                toast.loading(`Погашение долгов: ${i + 1}/${dealsToPay.length}...`, { id: loadingToast });
            } catch (err) {
                console.error(`Failed to pay for deal ${deal.id}`, err);
            }
        }
        
        toast.dismiss(loadingToast);
        toast.success("Все долги успешно погашены!");
        fetchData(); // Full refresh
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при массовой оплате");
        setLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredDeals.length === 0) {
        toast.error("Нет данных для экспорта");
        return;
    }

    try {
        // Define CSV headers
        const headers = ['Название', 'Компания', 'Дата создания', 'Сумма контракта', 'Оплачено', 'Остаток', 'Статус'];
        
        // Map data to rows
        const rows = filteredDeals.map(deal => {
            const stats = getDealStats(deal);
            return [
                `"${deal.title?.replace(/"/g, '""') || ''}"`,
                `"${deal.companies?.name?.replace(/"/g, '""') || ''}"`,
                format(parseISO(deal.created_at), 'dd.MM.yyyy'),
                deal.amount || 0,
                stats.paidTotal,
                stats.balance,
                deal.status === 'won' ? 'Выиграна' : deal.status === 'lost' ? 'Проиграна' : 'В работе'
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...rows].join('\n');
        
        // Create download link
        const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `deals_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success("Экспорт выполнен успешно");
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при экспорте");
    }
  };

  const getFilterLabel = () => {
    if (!dateRange?.from) return "За все время";
    
    // Check if it matches a full month
    if (dateRange.to) {
        const start = dateRange.from;
        const end = dateRange.to;
        if (start.getDate() === 1 && 
            end.getDate() === endOfMonth(end).getDate() && 
            start.getMonth() === end.getMonth() && 
            start.getFullYear() === end.getFullYear()) {
            // Check if it is current month
            if (isSameMonth(start, new Date())) return "Этот месяц";
            return format(start, 'LLLL yyyy', { locale: ru });
        }
    }
    
    if (dateRange.to) {
        return `${format(dateRange.from, 'dd MMM', { locale: ru })} - ${format(dateRange.to, 'dd MMM', { locale: ru })}`;
    }
    return format(dateRange.from, 'dd MMM yyyy', { locale: ru });
  };

  return (
    <TaskLabPage
      tag="Заказы"
      title="Заказы"
      subtitle="Сделки, поступления и контроль оплат"
      className="p-4 md:p-8 pb-24"
      actions={
        <div className="btt-hero-toolbar hidden md:flex">
          <div className="btt-hero-search">
            <Search aria-hidden />
            <input
              placeholder="Поиск сделки..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="button" className="btt-hero-tool" onClick={handlePayAll} title="Автоматически погасить все долги">
            <CircleCheck aria-hidden />
            Погасить всё
          </button>
          <button type="button" className="btt-hero-tool btt-hero-tool--icon" onClick={handleExport} title="Экспорт в CSV">
            <Download aria-hidden />
          </button>
          <CreateDealDialog onSuccess={() => fetchData(true)} />
        </div>
      }
    >
      <div className="space-y-8">
      {/* Mobile Actions */}
      <div className="md:hidden space-y-4">
          <div className="flex justify-end items-center gap-2">
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-neutral-200">
                              <MoreHorizontal className="h-5 w-5 text-neutral-500" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handlePayAll}>
                              <CircleCheck className="h-4 w-4 mr-2" /> Погасить всё
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExport}>
                              <Download className="h-4 w-4 mr-2" /> Экспорт CSV
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                  <CreateDealDialog onSuccess={() => fetchData(true)} trigger={
                      <Button size="icon" className="h-10 w-10 rounded-full bg-neutral-900 shadow-lg shadow-neutral-900/20">
                          <Plus className="h-5 w-5" />
                      </Button>
                  } />
              </div>
          
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input 
                  placeholder="Поиск по названию..." 
                  className="pl-9 w-full bg-white border-neutral-200 rounded-[1.75rem] h-11 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      {/* Stats Summary - Hide Scrollbar */}
      <div className="flex overflow-x-auto pb-2 gap-4 md:grid md:grid-cols-3 md:gap-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <TaskLabStat
          variant="dark"
          className="min-w-[75vw] md:min-w-0 snap-center"
          label="Ожидаемая выручка"
          value={new Intl.NumberFormat('uz-UZ').format(summary.expectedRevenue)}
          hint="Сумма контрактов (отображаемых)"
        />
        <TaskLabStat
          variant="lime"
          className="min-w-[75vw] md:min-w-0 snap-center"
          label="Фактически получено"
          value={new Intl.NumberFormat('uz-UZ').format(summary.receivedRevenue)}
          hint="Оплаты по отображаемым сделкам"
        />
        <TaskLabStat
          className="min-w-[75vw] md:min-w-0 snap-center"
          label="Дебиторская задолженность"
          value={<span className="text-red-500">{new Intl.NumberFormat('uz-UZ').format(summary.debtTotal)}</span>}
          hint="Долг по отображаемым сделкам"
        />
      </div>

      {/* Filters Toolbar - Mobile Optimized */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-transparent md:bg-white md:p-1.5 md:rounded-[2rem] md:border md:border-neutral-200 md:shadow-sm md:px-6">
        
        {/* Mobile Filter Chips */}
        <div className="flex flex-col gap-3 md:hidden w-full">
            {/* Status Buttons Row */}
            <div className="flex w-full gap-2">
                 <button
                    onClick={() => setFilterStatus('all')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-[1.75rem] text-sm font-medium transition-all ${
                        filterStatus === 'all' 
                        ? 'bg-neutral-900 text-white shadow-md shadow-neutral-900/10' 
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}
                 >
                    Все
                 </button>
                 <button
                    onClick={() => setFilterStatus('debt')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-[1.75rem] text-sm font-medium transition-all gap-1.5 ${
                        filterStatus === 'debt' 
                        ? 'bg-orange-100 text-orange-800 border-transparent' 
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}
                 >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Долги
                 </button>
                 <button
                    onClick={() => setFilterStatus('paid')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-[1.75rem] text-sm font-medium transition-all gap-1.5 ${
                        filterStatus === 'paid' 
                        ? 'bg-[var(--tasklab-lime)]/25 text-neutral-900 border-transparent' 
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}
                 >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Оплат.
                 </button>
            </div>
             
             {/* Date Filter - Full Width Row */}
             <Dialog>
                <DialogTrigger asChild>
                    <button className={`w-full flex items-center justify-center py-2.5 rounded-[1.75rem] text-sm font-medium transition-all gap-2 ${
                        dateRange?.from 
                        ? 'bg-[var(--tasklab-lime)]/15 text-neutral-900 border border-neutral-200' 
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}>
                        <CalendarIcon className="w-4 h-4" />
                        {getFilterLabel()}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-[340px] p-0 rounded-2xl gap-0">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle className="text-center">Выберите период</DialogTitle>
                        <DialogDescription className="sr-only">
                            Выберите диапазон дат для фильтрации сделок
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col">
                         <div className="grid grid-cols-2 gap-2 p-3 bg-neutral-50/50 border-y border-neutral-100">
                             <Button 
                                 variant="outline" 
                                 size="sm"
                                 className="text-xs h-9 bg-white shadow-sm"
                                 onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                             >
                                 Этот месяц
                             </Button>
                             <Button 
                                 variant="outline" 
                                 size="sm"
                                 className="text-xs h-9 bg-white shadow-sm"
                                 onClick={() => setDateRange({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })}
                             >
                                 Прошлый месяц
                             </Button>
                              <Button 
                                 variant="outline" 
                                 size="sm"
                                 className="text-xs h-9 bg-white shadow-sm"
                                 onClick={() => setDateRange({ from: startOfYear(new Date()), to: endOfMonth(new Date()) })}
                             >
                                 Этот год
                             </Button>
                             <Button 
                                 variant="ghost" 
                                 size="sm"
                                 className="text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                                 onClick={() => setDateRange(undefined)}
                             >
                                 Сбросить
                             </Button>
                         </div>
                        <div className="flex justify-center p-2">
                            <Calendar
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={1}
                                locale={ru}
                                className="rounded-md"
                            />
                        </div>
                    </div>
                </DialogContent>
             </Dialog>
        </div>

        {/* Desktop Filter Tabs */}
        <Tabs value={filterStatus} onValueChange={setFilterStatus} className="hidden md:block w-full md:w-auto">
            <TabsList className="h-10 bg-transparent p-0 gap-1">
                <TabsTrigger 
                    value="all" 
                    className="data-[state=active]:bg-neutral-900 data-[state=active]:text-white text-neutral-500 rounded-full px-4 transition-all"
                >
                    Все сделки
                </TabsTrigger>
                <TabsTrigger 
                    value="debt" 
                    className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 text-neutral-500 rounded-full px-4 gap-2 transition-all"
                >
                    <AlertCircle className="w-4 h-4" />
                    С долгами
                </TabsTrigger>
                <TabsTrigger 
                    value="paid" 
                    className="data-[state=active]:bg-[var(--tasklab-lime)]/25 data-[state=active]:text-neutral-900 text-neutral-500 rounded-full px-4 gap-2 transition-all"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Оплачены
                </TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="hidden md:flex items-center gap-2 w-full md:w-auto md:border-l md:border-neutral-200 md:pl-4 md:ml-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-10 gap-2 text-sm font-medium hover:bg-neutral-50 rounded-full px-4">
                        <CalendarIcon className="w-4 h-4 text-neutral-500" />
                        <span className="capitalize text-neutral-900">{getFilterLabel()}</span>
                        <ChevronDown className="w-3 h-3 text-neutral-400 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[1.75rem] shadow-xl" align="end">
                    <div className="flex flex-col sm:flex-row">
                        <div className="border-b sm:border-b-0 sm:border-r border-neutral-100 p-2 flex flex-col gap-1 min-w-[140px] bg-neutral-50/50">
                            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1 mb-1">Период</div>
                            <Button 
                                variant="ghost" 
                                className="justify-start text-xs font-medium h-8 px-2"
                                onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                            >
                                Этот месяц
                            </Button>
                            <Button 
                                variant="ghost" 
                                className="justify-start text-xs font-medium h-8 px-2"
                                onClick={() => setDateRange({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })}
                            >
                                Прошлый месяц
                            </Button>
                             <Button 
                                variant="ghost" 
                                className="justify-start text-xs font-medium h-8 px-2"
                                onClick={() => setDateRange({ from: startOfYear(new Date()), to: endOfMonth(new Date()) })}
                            >
                                С начала года
                            </Button>
                            <div className="h-px bg-neutral-200 my-1 mx-2" />
                            <Button 
                                variant="ghost" 
                                className="justify-start text-xs font-medium h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDateRange(undefined)}
                            >
                                Сбросить
                            </Button>
                        </div>
                        <div className="p-0">
                            <Calendar
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={1}
                                locale={ru}
                                className="rounded-r-xl"
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
      </div>

      {/* Deals List */}
      <div className="grid gap-6">
        {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-36 rounded-2xl border border-neutral-200 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 animate-pulse"
                />
              ))}
            </div>
        ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 tasklab-card-dashed">
                <p className="text-neutral-500">Сделки не найдены</p>
            </div>
        ) : (
            <AnimatePresence>
            {visibleDeals.map((deal) => {
                const stats = getDealStats(deal);
                
                return (
                    <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        layout
                    >
                        <DealCard 
                            deal={deal}
                            stats={stats}
                            isExcluded={excludedDealIds.has(deal.id)}
                            onEdit={openDealForEdit}
                            onDelete={handleDeleteDeal}
                            onAddPayment={openAddPaymentDialog}
                            onDeletePayment={handleDeletePayment}
                            onView={openDealForView}
                        />
                    </motion.div>
                );
            })}
            </AnimatePresence>
        )}
      </div>
      {!loading && hasMoreDeals && (
        <div ref={loadMoreDealsRef} className="h-10 flex items-center justify-center">
          <span className="text-xs text-neutral-400">
            Загружено {visibleDeals.length} из {filteredDeals.length}
          </span>
        </div>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold text-neutral-900">Внести оплату</DialogTitle>
                <DialogDescription className="text-neutral-500">
                    {selectedDeal ? `По сделке: ${selectedDeal.title}` : 'Укажите сумму и дату оплаты'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-2">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right font-medium text-neutral-600">Сумма</Label>
                    <div className="col-span-3 relative">
                        <Input 
                            type="number" 
                            className="bg-neutral-50 border-neutral-200 rounded-[1.75rem] pr-14 h-10" 
                            placeholder="0"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                        />
                         {/* Helper to fill remaining balance */}
                         {selectedDeal && (
                             <button 
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-neutral-200 hover:bg-neutral-300 text-neutral-600 px-2 py-1 rounded-md font-bold transition-colors shadow-sm"
                                onClick={() => {
                                    const stats = getDealStats(selectedDeal);
                                    if (stats.balance > 0) {
                                        setNewPayment(prev => ({ ...prev, amount: stats.balance.toString() }));
                                    }
                                }}
                                title="Вставить остаток долга"
                             >
                                MAX
                             </button>
                         )}
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right font-medium text-neutral-600">Дата</Label>
                    <Input 
                        type="date" 
                        className="col-span-3 bg-neutral-50 border-neutral-200 rounded-[1.75rem] h-10"
                        value={newPayment.date}
                        onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right font-medium text-neutral-600">Примеч.</Label>
                    <Input 
                        className="col-span-3 bg-neutral-50 border-neutral-200 rounded-[1.75rem] h-10" 
                        placeholder="Например: Аванс"
                        value={newPayment.note}
                        onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
                <Button 
                    variant="ghost" 
                    onClick={() => setIsPaymentOpen(false)}
                    className="text-neutral-500 hover:text-neutral-900"
                >
                    Отмена
                </Button>
                <Button 
                    onClick={handleAddPayment} 
                    className="bg-neutral-900 text-white hover:bg-neutral-800 rounded-[1.75rem] px-6"
                >
                    Сохранить
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditDealDialog 
        deal={dealToEdit} 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        onSuccess={() => fetchData(true)} 
      />

      <DealDetailSheet 
        deal={dealToView}
        stats={dealToView ? getDealStats(dealToView) : null}
        open={isDetailOpen} 
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) clearFocus();
        }}
        onEdit={(d) => {
          setIsDetailOpen(false);
          setDealToEdit(d);
          setIsEditOpen(true);
        }}
        onDelete={handleDeleteDeal}
        onPaymentAdded={() => fetchData(true)}
        onPaymentDeleted={handleDeletePayment}
      />
      </div>
    </TaskLabPage>
  );
}