import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Plus, Search, DollarSign, Calendar as CalendarIcon, MoreHorizontal, ArrowUpRight, ArrowDownLeft, Trash2, FileText, CheckCircle2, AlertCircle, ChevronDown, Wand2, Download } from 'lucide-react';
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
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { Pencil } from 'lucide-react';

export default function Deals() {
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch deals (CRM API)
      const { data: dealsData, error } = await crm
        .from('deals')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch Payments from Server KV
      const response = await fetch(`${crmUrl('/payments')}`, {
        headers: { ...authHeaders(false) }
      });
      
      const paymentsData = response.ok ? await response.json() : [];

      // 3. Fetch Excluded Metadata
      const metaResponse = await fetch(`${crmUrl('/deals/excluded')}`, {
        headers: { ...authHeaders(false) }
      });
      const metaData = metaResponse.ok ? await metaResponse.json() : { excludedIds: [] };
      setExcludedDealIds(new Set(metaData.excludedIds || []));

      setDeals(dealsData || []);
      setPayments(paymentsData || []);

    } catch (e) {
      console.error(e);
      toast.error("Ошибка загрузки данных");
    } finally {
      if (!silent) setLoading(false);
    }
  };

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
                    note: 'Автомтическое погашение'
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

  // Helper to calculate stats per deal
  const getDealStats = (deal: any) => {
    const dealPayments = payments.filter(p => p.dealId === deal.id);
    const paidTotal = dealPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const dealTotal = deal.amount || 0;
    const balance = dealTotal - paidTotal;
    const percentage = dealTotal > 0 ? (paidTotal / dealTotal) * 100 : 0;
    
    return { paidTotal, balance, percentage, dealPayments };
  };

  const filteredDeals = deals.filter(deal => {
    // 1. Search Term
    const matchesSearch = deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          deal.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Date Range Filter
    if (dateRange?.from) {
        const dealDate = parseISO(deal.created_at);
        const end = dateRange.to || dateRange.from;
        // Adjust end date to end of day to include deals created on that day
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

  // Filter payments to exclude those from deleted deals
  const validPayments = payments.filter(p => deals.some(d => d.id === p.dealId));

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-24">
      
      {/* Mobile Header & Actions */}
      <div className="md:hidden space-y-4">
          <div className="flex justify-between items-center">
              <div>
                  <h1 className="text-2xl font-bold text-slate-900">Сделки</h1>
                  <p className="text-xs text-slate-500">Финансы и контроль</p>
              </div>
              <div className="flex gap-2">
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-slate-200">
                              <MoreHorizontal className="h-5 w-5 text-slate-500" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handlePayAll}>
                              <Wand2 className="h-4 w-4 mr-2" /> Погасить всё
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExport}>
                              <Download className="h-4 w-4 mr-2" /> Экспорт CSV
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                  <CreateDealDialog onSuccess={() => fetchData(true)} trigger={
                      <Button size="icon" className="h-10 w-10 rounded-full bg-slate-900 shadow-lg shadow-slate-900/20">
                          <Plus className="h-5 w-5" />
                      </Button>
                  } />
              </div>
          </div>
          
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                  placeholder="Поик по названию..." 
                  className="pl-9 w-full bg-white border-slate-200 rounded-xl h-11 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Финансы сделок</h1>
          <p className="text-slate-500 mt-1">Контроль поступлений и кассовых разрывов</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Поиск сделки..." 
                    className="pl-9 w-64 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <Button variant="outline" className="text-slate-500 hover:text-emerald-600 border-dashed" onClick={handlePayAll} title="Автоматически погасить все долги">
                <Wand2 className="h-4 w-4 mr-2" />
                Погасить всё
             </Button>
             <Button variant="outline" className="text-slate-500 hover:text-blue-600 border-dashed" onClick={handleExport} title="Экспорт в CSV">
                <Download className="h-4 w-4" />
             </Button>
             <CreateDealDialog onSuccess={() => fetchData(true)} />
        </div>
      </div>

      {/* Stats Summary - Hide Scrollbar */}
      <div className="flex overflow-x-auto pb-2 gap-4 md:grid md:grid-cols-3 md:gap-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Card className="bg-slate-900 text-white border-none shadow-lg min-w-[75vw] md:min-w-0 snap-center">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Ожидаемая выручка</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">
                    {new Intl.NumberFormat('uz-UZ').format(
                        filteredDeals
                            .filter(d => !excludedDealIds.has(d.id) && (d.status === 'open' || d.status === 'won'))
                            .reduce((sum, d) => sum + (d.amount || 0), 0)
                    )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Сумма контрактов (отображаемых)</div>
            </CardContent>
        </Card>
        
        <Card className="bg-emerald-600 text-white border-none shadow-lg min-w-[75vw] md:min-w-0 snap-center">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-100">Фактически получено</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">
                    {new Intl.NumberFormat('uz-UZ').format(
                        filteredDeals
                            .filter(d => !excludedDealIds.has(d.id))
                            .reduce((sum, deal) => {
                                 const stats = getDealStats(deal);
                                 return sum + stats.paidTotal;
                            }, 0)
                    )}
                </div>
                <div className="text-xs text-emerald-100 mt-1">Оплаты по отображаемым сделкам</div>
            </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm min-w-[75vw] md:min-w-0 snap-center">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Дебиторская задолженность</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-red-500">
                    {new Intl.NumberFormat('uz-UZ').format(
                        filteredDeals
                            .filter(d => !excludedDealIds.has(d.id) && d.status === 'won')
                            .reduce((sum, d) => sum + getDealStats(d).balance, 0)
                    )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Долг по отображаемым сделкам</div>
            </CardContent>
        </Card>
      </div>

      {/* Filters Toolbar - Mobile Optimized */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-transparent md:bg-white md:p-1.5 md:rounded-[2rem] md:border md:border-slate-200 md:shadow-sm md:px-6">
        
        {/* Mobile Filter Chips */}
        <div className="flex flex-col gap-3 md:hidden w-full">
            {/* Status Buttons Row */}
            <div className="flex w-full gap-2">
                 <button
                    onClick={() => setFilterStatus('all')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-sm font-medium transition-all ${
                        filterStatus === 'all' 
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                 >
                    Все
                 </button>
                 <button
                    onClick={() => setFilterStatus('debt')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-sm font-medium transition-all gap-1.5 ${
                        filterStatus === 'debt' 
                        ? 'bg-orange-100 text-orange-800 border-transparent' 
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                 >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Долги
                 </button>
                 <button
                    onClick={() => setFilterStatus('paid')}
                    className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-sm font-medium transition-all gap-1.5 ${
                        filterStatus === 'paid' 
                        ? 'bg-emerald-100 text-emerald-800 border-transparent' 
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                 >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Оплат.
                 </button>
            </div>
             
             {/* Date Filter - Full Width Row */}
             <Dialog>
                <DialogTrigger asChild>
                    <button className={`w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-all gap-2 ${
                        dateRange?.from 
                        ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                        : 'bg-white border border-slate-200 text-slate-600'
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
                         <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/50 border-y border-slate-100">
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
                    className="data-[state=active]:bg-slate-900 data-[state=active]:text-white text-slate-500 rounded-full px-4 transition-all"
                >
                    Все сделки
                </TabsTrigger>
                <TabsTrigger 
                    value="debt" 
                    className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 text-slate-500 rounded-full px-4 gap-2 transition-all"
                >
                    <AlertCircle className="w-4 h-4" />
                    С долгами
                </TabsTrigger>
                <TabsTrigger 
                    value="paid" 
                    className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 text-slate-500 rounded-full px-4 gap-2 transition-all"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Оплачены
                </TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="hidden md:flex items-center gap-2 w-full md:w-auto md:border-l md:border-slate-200 md:pl-4 md:ml-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-10 gap-2 text-sm font-medium hover:bg-slate-50 rounded-full px-4">
                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                        <span className="capitalize text-slate-900">{getFilterLabel()}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl shadow-xl" align="end">
                    <div className="flex flex-col sm:flex-row">
                        <div className="border-b sm:border-b-0 sm:border-r border-slate-100 p-2 flex flex-col gap-1 min-w-[140px] bg-slate-50/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">Период</div>
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
                            <div className="h-px bg-slate-200 my-1 mx-2" />
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
            <div className="text-center py-12 text-slate-500">Загрузка данных...</div>
        ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-500">Сделки не найдены</p>
            </div>
        ) : (
            <AnimatePresence>
            {filteredDeals.map((deal, index) => {
                const stats = getDealStats(deal);
                
                return (
                    <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        layout
                    >
                        <DealCard 
                            deal={deal}
                            stats={stats}
                            isExcluded={excludedDealIds.has(deal.id)}
                            onEdit={(d) => {
                                setDealToEdit(d);
                                setIsEditOpen(true);
                            }}
                            onDelete={handleDeleteDeal}
                            onAddPayment={(d) => {
                                setSelectedDeal(d);
                                setNewPayment({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
                                setIsPaymentOpen(true);
                            }}
                            onDeletePayment={handleDeletePayment}
                            onView={(d) => {
                                setDealToView(d);
                                setIsDetailOpen(true);
                            }}
                        />
                    </motion.div>
                );
            })}
            </AnimatePresence>
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold text-slate-900">Внести оплату</DialogTitle>
                <DialogDescription className="text-slate-500">
                    {selectedDeal ? `По сдел��е: ${selectedDeal.title}` : 'Укажите сумму и дату оплаты'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-2">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right font-medium text-slate-600">Сумма</Label>
                    <div className="col-span-3 relative">
                        <Input 
                            type="number" 
                            className="bg-slate-50 border-slate-200 rounded-xl pr-14 h-10" 
                            placeholder="0"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                        />
                         {/* Helper to fill remaining balance */}
                         {selectedDeal && (
                             <button 
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded-md font-bold transition-colors shadow-sm"
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
                    <Label className="text-right font-medium text-slate-600">Дата</Label>
                    <Input 
                        type="date" 
                        className="col-span-3 bg-slate-50 border-slate-200 rounded-xl h-10"
                        value={newPayment.date}
                        onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right font-medium text-slate-600">Примеч.</Label>
                    <Input 
                        className="col-span-3 bg-slate-50 border-slate-200 rounded-xl h-10" 
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
                    className="text-slate-500 hover:text-slate-900"
                >
                    Отмена
                </Button>
                <Button 
                    onClick={handleAddPayment} 
                    className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-6"
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
        onOpenChange={setIsDetailOpen}
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
  );
}