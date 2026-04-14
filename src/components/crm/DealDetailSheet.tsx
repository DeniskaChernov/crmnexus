import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Edit3, Trash2, Plus, Receipt, Building2, CalendarDays,
  CheckCircle2, Clock, AlertCircle, Loader2, Package2,
  User, MessageSquare, ArrowRight, Banknote, TrendingUp,
  ChevronRight, FileText, Phone, X, Wallet, ShoppingCart,
  History, CircleDollarSign,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import { getTimeline, TimelineEvent } from '../../utils/crm/timeline';

interface DealDetailSheetProps {
  deal: any;
  stats: {
    paidTotal: number;
    balance: number;
    percentage: number;
    dealPayments: any[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (deal: any) => void;
  onDelete: (id: string) => void;
  onPaymentAdded: () => void;
  onPaymentDeleted: (id: string) => void;
}

const STATUS_CONFIG = {
  open:  { label: 'В работе',  bg: 'bg-blue-500',    pill: 'bg-blue-500/20 text-blue-200 border-blue-400/30',    icon: Clock },
  won:   { label: 'Выиграна',  bg: 'bg-emerald-500', pill: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30', icon: CheckCircle2 },
  lost:  { label: 'Проиграна', bg: 'bg-red-500',     pill: 'bg-red-500/20 text-red-200 border-red-400/30',       icon: AlertCircle },
};

const TIMELINE_TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  status_change: { icon: ArrowRight,     color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
  stage_change:  { icon: ChevronRight,   color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100' },
  note:          { icon: MessageSquare,  color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
  update:        { icon: Edit3,          color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
  create:        { icon: Plus,           color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  email:         { icon: FileText,       color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100' },
  call:          { icon: Phone,          color: 'text-teal-600',    bg: 'bg-teal-50 border-teal-100' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(n));

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('uz-UZ', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function DealDetailSheet({
  deal, stats, open, onOpenChange, onEdit, onDelete, onPaymentAdded, onPaymentDeleted,
}: DealDetailSheetProps) {
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [dealItems, setDealItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [activeTab, setActiveTab] = useState('payments');

  useEffect(() => {
    if (open && deal) {
      setIsAddingPayment(false);
      setPaymentForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      setActiveTab('payments');
      setDealItems([]);
      setTimeline([]);
    }
  }, [open, deal?.id]);

  useEffect(() => {
    if (open && deal && activeTab === 'items') fetchItems();
    if (open && deal && activeTab === 'timeline') fetchTimeline();
  }, [activeTab, open, deal?.id]);

  const fetchItems = async () => {
    if (!deal?.id) return;
    setLoadingItems(true);
    try {
      const res = await fetch(`${crmUrl(`/deal-items/${deal.id}`)}`, {
        headers: { ...authHeaders(false) },
      });
      setDealItems(res.ok ? await res.json() : []);
    } catch { setDealItems([]); }
    finally { setLoadingItems(false); }
  };

  const fetchTimeline = async () => {
    if (!deal?.id) return;
    setLoadingTimeline(true);
    try { setTimeline(await getTimeline(deal.id)); }
    catch { setTimeline([]); }
    finally { setLoadingTimeline(false); }
  };

  const handleAddPayment = async () => {
    if (!deal || !paymentForm.amount) { toast.error('Введите сумму'); return; }
    setSubmittingPayment(true);
    try {
      const res = await fetch(`${crmUrl('/payments')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({ dealId: deal.id, amount: parseFloat(paymentForm.amount), date: paymentForm.date, note: paymentForm.note }),
      });
      if (!res.ok) throw new Error();
      toast.success('Оплата добавлена');
      setPaymentForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      setIsAddingPayment(false);
      onPaymentAdded();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSubmittingPayment(false); }
  };

  if (!deal || !stats) return null;

  const statusCfg = STATUS_CONFIG[deal.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
  const StatusIcon = statusCfg.icon;
  const isPaid = stats.balance <= 0;
  const sortedPayments = [...stats.dealPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const itemsTotal = dealItems.reduce((s, i) =>
    s + (parseFloat(String(i.quantity).replace(',', '.')) || 0) * (parseFloat(String(i.price).replace(',', '.')) || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[580px] p-0 flex flex-col gap-0 overflow-hidden bg-white border-l border-slate-200 shadow-2xl">
        <SheetTitle className="sr-only">{deal.title}</SheetTitle>
        <SheetDescription className="sr-only">Детали сделки</SheetDescription>

        {/* ══════════ HERO HEADER ══════════ */}
        <div className="relative flex-shrink-0 bg-slate-900 px-6 pt-5 pb-6 overflow-hidden">
          {/* Decorative blob */}
          <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10 blur-2xl ${statusCfg.bg}`} />
          <div className={`absolute bottom-0 left-1/2 w-72 h-16 rounded-full opacity-5 blur-3xl ${statusCfg.bg}`} />

          {/* Top row: close + status */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.pill}`}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/70 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title & meta */}
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white leading-snug mb-2">{deal.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {deal.companies?.name && (
                <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-slate-300 font-medium">{deal.companies.name}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <CalendarDays className="w-3.5 h-3.5" />
                {format(parseISO(deal.created_at), 'd MMMM yyyy', { locale: ru })}
              </span>
            </div>
          </div>

          {/* ── Financial metrics strip ── */}
          <div className="relative z-10 mt-5 grid grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {[
              { label: 'Сумма',    value: deal.amount || 0, color: 'text-white',         sub: 'UZS' },
              { label: 'Оплачено', value: stats.paidTotal,  color: 'text-emerald-400',   sub: `${stats.percentage.toFixed(0)}%` },
              { label: 'Остаток',  value: stats.balance,    color: isPaid ? 'text-emerald-400' : 'text-orange-400', sub: isPaid ? 'Закрыта' : 'Долг' },
            ].map((m, idx) => (
              <div key={m.label} className="bg-white/5 px-3 py-4 flex flex-col items-center text-center">
                <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">{m.label}</p>
                <p className={`text-base font-bold leading-none ${m.color} tabular-nums`}>{fmt(m.value)}</p>
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Progress bar ── */}
          <div className="relative z-10 mt-4">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-medium">
              <span>Прогресс оплаты</span>
              <span className={isPaid ? 'text-emerald-400' : 'text-slate-300'}>{stats.percentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-blue-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(stats.percentage, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* ══════════ TABS ══════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <TabsList className="flex-shrink-0 h-11 bg-white border-b border-slate-100 rounded-none justify-start px-2 gap-0 w-full">
            {[
              { value: 'payments', label: 'Оплаты',  icon: Wallet,       count: sortedPayments.length },
              { value: 'items',    label: 'Товары',  icon: ShoppingCart, count: null },
              { value: 'timeline', label: 'История', icon: History,      count: null },
            ].map(t => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="relative h-11 px-4 rounded-none text-sm text-slate-500 font-medium
                  data-[state=active]:text-slate-900 data-[state=active]:shadow-none
                  data-[state=active]:bg-transparent
                  after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t
                  data-[state=active]:after:bg-slate-900 after:bg-transparent
                  transition-colors gap-2"
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className="ml-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══ PAYMENTS TAB ══ */}
          <TabsContent value="payments" className="flex-1 overflow-hidden mt-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-5 space-y-3">

                {/* Payment rows */}
                {sortedPayments.length === 0 && !isAddingPayment ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <CircleDollarSign className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Оплат пока нет</p>
                    <p className="text-xs text-slate-400 mt-1">Нажмите «Добавить оплату» ниже</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {sortedPayments.map((payment, idx) => (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm hover:border-slate-200 hover:shadow transition-all group/pay"
                        >
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Banknote className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm tabular-nums">
                              +{fmt(payment.amount)} <span className="text-[10px] font-normal text-slate-400">UZS</span>
                            </p>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {format(parseISO(payment.date), 'd MMM yyyy', { locale: ru })}
                              {payment.note && <span className="ml-1.5 text-slate-500">· {payment.note}</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => onPaymentDeleted(payment.id)}
                            className="opacity-0 group-hover/pay:opacity-100 transition-all w-7 h-7 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Add payment inline form ── */}
                <AnimatePresence>
                  {isAddingPayment ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-slate-900 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-white uppercase tracking-widest">Новая оплата</p>
                        <button onClick={() => setIsAddingPayment(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Amount */}
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Сумма в UZS"
                          value={paymentForm.amount}
                          onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 pr-16 text-white placeholder-slate-500 text-lg font-bold focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                        />
                        {stats.balance > 0 && (
                          <button
                            type="button"
                            onClick={() => setPaymentForm(p => ({ ...p, amount: String(stats.balance) }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg font-bold transition-colors"
                          >
                            MAX
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-semibold">Дата</label>
                          <input
                            type="date"
                            value={paymentForm.date}
                            onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                            className="w-full h-9 bg-white/10 border border-white/20 rounded-xl px-3 text-white text-sm focus:outline-none focus:border-white/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-semibold">Примечание</label>
                          <input
                            type="text"
                            placeholder="Аванс, оплата #2..."
                            value={paymentForm.note}
                            onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                            className="w-full h-9 bg-white/10 border border-white/20 rounded-xl px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-white/40 transition-all"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleAddPayment}
                        disabled={submittingPayment || !paymentForm.amount}
                        className="w-full h-10 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submittingPayment
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><CheckCircle2 className="w-4 h-4" />Сохранить оплату</>
                        }
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setIsAddingPayment(true)}
                      className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900 hover:bg-slate-50 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить оплату
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Summary row */}
                {sortedPayments.length > 0 && (
                  <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-400">
                    <span>{sortedPayments.length} {sortedPayments.length === 1 ? 'платёж' : sortedPayments.length < 5 ? 'платежа' : 'платежей'}</span>
                    <span className="font-semibold text-slate-600">Итого: {fmt(stats.paidTotal)} UZS</span>
                  </div>
                )}

                {/* Notes */}
                {deal.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Заметки</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{deal.notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ══ ITEMS TAB ══ */}
          <TabsContent value="items" className="flex-1 overflow-hidden mt-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-5">
                {loadingItems ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    <p className="text-xs text-slate-400">Загрузка позиций...</p>
                  </div>
                ) : dealItems.length === 0 ? (
                  <div className="py-14 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Package2 className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Нет позиций товара</p>
                    <p className="text-xs text-slate-400 mt-1">Добавьте товары через редактирование сделки</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <div className="col-span-5">Позиция</div>
                      <div className="col-span-2 text-right">Кол-во</div>
                      <div className="col-span-3 text-right">Цена</div>
                      <div className="col-span-2 text-right">Сумма</div>
                    </div>

                    {dealItems.map((item, i) => {
                      const qty = parseFloat(String(item.quantity).replace(',', '.')) || 0;
                      const price = parseFloat(String(item.price).replace(',', '.')) || 0;
                      const total = qty * price;
                      const isProduction = item.type === 'production';
                      return (
                        <div key={item.id || i}
                          className="bg-white border border-slate-100 rounded-xl grid grid-cols-12 gap-1 px-3 py-3 shadow-sm hover:border-slate-200 hover:shadow transition-all"
                        >
                          <div className="col-span-5 min-w-0 flex items-start gap-2.5">
                            <div className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] ${isProduction ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>
                              {isProduction ? '🏭' : '📦'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate leading-tight">{item.article || '—'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{isProduction ? 'На заказ' : 'Со склада'}</p>
                            </div>
                          </div>
                          <div className="col-span-2 text-right self-center">
                            <p className="text-sm font-semibold text-slate-800 tabular-nums">{qty.toLocaleString('ru')}</p>
                            <p className="text-[10px] text-slate-400">{item.unit || 'шт'}</p>
                          </div>
                          <div className="col-span-3 text-right self-center">
                            <p className="text-sm text-slate-600 tabular-nums">{fmtCompact(price)}</p>
                          </div>
                          <div className="col-span-2 text-right self-center">
                            <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtCompact(total)}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Totals */}
                    <div className="bg-slate-900 rounded-xl px-4 py-3 flex items-center justify-between mt-3">
                      <span className="text-sm font-semibold text-slate-300">Итого по позициям</span>
                      <span className="text-base font-bold text-white tabular-nums">{fmt(itemsTotal)} <span className="text-xs font-normal text-slate-400">UZS</span></span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ══ TIMELINE TAB ══ */}
          <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-5">
                {loadingTimeline ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    <p className="text-xs text-slate-400">Загрузка истории...</p>
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="py-14 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">История изменений пуста</p>
                  </div>
                ) : (
                  <div className="relative space-y-3">
                    {/* Vertical line */}
                    <div className="absolute left-[18px] top-5 bottom-5 w-px bg-slate-100" />

                    {timeline.map((evt, i) => {
                      const tCfg = TIMELINE_TYPE_CONFIG[evt.type] || TIMELINE_TYPE_CONFIG.update;
                      const TIcon = tCfg.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex gap-3 relative"
                        >
                          {/* Dot */}
                          <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${tCfg.bg}`}>
                            <TIcon className={`w-4 h-4 ${tCfg.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm hover:border-slate-200 transition-colors">
                            <p className="text-sm font-medium text-slate-900 leading-snug">{evt.message}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <User className="w-3 h-3" />
                                {evt.userName}
                              </span>
                              <span className="text-slate-200">·</span>
                              <span className="text-[11px] text-slate-400">
                                {formatDistanceToNow(new Date(evt.createdAt), { locale: ru, addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* ══════════ FOOTER ══════════ */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-white">
          <button
            onClick={() => { onDelete(deal.id); onOpenChange(false); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Удалить</span>
          </button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 px-4 text-sm rounded-xl" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
            <Button size="sm" className="h-9 px-4 text-sm rounded-xl bg-slate-900 hover:bg-slate-700 gap-1.5"
              onClick={() => { onOpenChange(false); onEdit(deal); }}>
              <Edit3 className="w-3.5 h-3.5" />
              Редактировать
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}