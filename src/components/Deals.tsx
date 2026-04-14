import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Plus, Search, DollarSign, Calendar as CalendarIcon, MoreHorizontal, ArrowUpRight, ArrowDownLeft, Trash2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function Deals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Payment Dialog State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch deals
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

      setDeals(dealsData || []);
      setPayments(paymentsData || []);

    } catch (e) {
      console.error(e);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
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
      fetchData(); // Refresh data
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
      fetchData();
    } catch (e) {
      toast.error("Ошибка удаления");
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

  const filteredDeals = deals.filter(deal => 
    deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-24">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Финансы сделок</h1>
          <p className="text-slate-500 mt-1">Контроль поступлений и кассовых разрывов</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Поиск сделки..." 
                    className="pl-9 w-full md:w-64 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 text-white border-none shadow-lg">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Ожидаемая выручка</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">
                    {new Intl.NumberFormat('uz-UZ').format(
                        deals.filter(d => d.status === 'open' || d.status === 'won').reduce((sum, d) => sum + (d.amount || 0), 0)
                    )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Сумма контрактов</div>
            </CardContent>
        </Card>
        
        <Card className="bg-emerald-600 text-white border-none shadow-lg">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-100">Фактически получено</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">
                    {new Intl.NumberFormat('uz-UZ').format(
                        payments.reduce((sum, p) => sum + (p.amount || 0), 0)
                    )}
                </div>
                <div className="text-xs text-emerald-100 mt-1">Оплаты</div>
            </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Дебиторская задолженность</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-red-500">
                    {new Intl.NumberFormat('uz-UZ').format(
                        deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.amount || 0), 0) - 
                        payments.reduce((sum, p) => sum + (p.amount || 0), 0)
                    )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Долг</div>
            </CardContent>
        </Card>
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
            filteredDeals.map(deal => {
                const stats = getDealStats(deal);
                const isPaid = stats.balance <= 0;
                
                return (
                    <Card key={deal.id} className={`overflow-hidden transition-all hover:shadow-md ${isPaid ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500'}`}>
                        <div className="flex flex-col md:flex-row">
                            
                            {/* Left: Deal Info */}
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-slate-900">{deal.title}</h3>
                                            <Badge variant="outline" className={
                                                deal.status === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                deal.status === 'lost' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                'bg-blue-50 text-blue-700 border-blue-200'
                                            }>
                                                {deal.status === 'won' ? 'Выиграна' : deal.status === 'lost' ? 'Проиграна' : 'В работе'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                            <FileText className="h-3 w-3" />
                                            <span>{deal.companies?.name || 'Нет компании'}</span>
                                            <span>•</span>
                                            <span>{format(parseISO(deal.created_at), 'dd MMM yyyy', { locale: ru })}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-slate-900">
                                            {new Intl.NumberFormat('uz-UZ').format(deal.amount || 0)} сум
                                        </div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Сумма контракта</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Оплачено: {stats.percentage.toFixed(0)}%</span>
                                        <span className={stats.balance > 0 ? "text-orange-600 font-medium" : "text-emerald-600 font-medium"}>
                                            {stats.balance > 0 ? `Остаток: ${new Intl.NumberFormat('uz-UZ').format(stats.balance)}` : "Оплачено полностью"}
                                        </span>
                                    </div>
                                    <Progress value={stats.percentage} className="h-2" />
                                </div>
                            </div>

                            {/* Right: Payments List & Actions */}
                            <div className="bg-slate-50 p-6 md:w-[400px] border-l border-slate-100 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-sm text-slate-700">История оплат</h4>
                                    <Button size="sm" variant="outline" className="h-8 gap-1 bg-white" onClick={() => {
                                        setSelectedDeal(deal);
                                        setNewPayment({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
                                        setIsPaymentOpen(true);
                                    }}>
                                        <Plus className="h-3 w-3" /> Добавить
                                    </Button>
                                </div>

                                <div className="flex-1 space-y-2 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                                    {stats.dealPayments.length === 0 ? (
                                        <div className="text-xs text-slate-400 text-center py-4 italic">Нет поступлений</div>
                                    ) : (
                                        stats.dealPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => (
                                            <div key={payment.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center group">
                                                <div>
                                                    <div className="font-bold text-emerald-600 text-sm">
                                                        +{new Intl.NumberFormat('uz-UZ').format(payment.amount)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        {format(parseISO(payment.date), 'dd.MM.yyyy')}
                                                        {payment.note && <span className="truncate max-w-[100px]">• {payment.note}</span>}
                                                    </div>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                                                    onClick={() => handleDeletePayment(payment.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Внести оплату</DialogTitle>
                <DialogDescription>
                    {selectedDeal && `По сделке: ${selectedDeal.title}`}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Сумма</Label>
                    <Input 
                        type="number" 
                        className="col-span-3" 
                        placeholder="0"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Дата</Label>
                    <Input 
                        type="date" 
                        className="col-span-3"
                        value={newPayment.date}
                        onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Примеч.</Label>
                    <Input 
                        className="col-span-3" 
                        placeholder="Например: Аванс"
                        value={newPayment.note}
                        onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Отмена</Button>
                <Button onClick={handleAddPayment}>Сохранить</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}