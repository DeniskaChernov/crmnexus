import React, { useState, useEffect, useMemo } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, parseISO, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Loader2, 
  Trash2, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Factory,
  RefreshCcw,
  Scale,
  Zap,
  Edit3,
  ArrowRight,
  Info,
  ChevronDown,
  ClipboardList,
  Link2,
  GripVertical,
  ArrowDownToLine,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { Textarea } from '../components/ui/textarea';
import { motion, AnimatePresence } from 'motion/react';

interface ProductionEvent {
  id: string;
  lineId: string;
  recipeId?: string;
  amount?: string;
  startDate: string;
  endDate: string;
  notes?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'issue';
}

interface Recipe {
  id: string;
  name: string;
}

interface ProductionOrder {
  id: string;
  dealId: string;
  dealTitle: string;
  companyName: string;
  items: Array<{ article: string; quantity: number; price?: number; warehouse?: string }>;
  status: string;
  createdAt: string;
}

const LINES = [
  { id: 'extruder-1', name: 'Экструдер №1', shortName: 'Экстр. 1', type: 'extruder', description: 'Универсальная линия', color: 'blue' },
  { id: 'extruder-2', name: 'Экструдер №2', shortName: 'Экстр. 2', type: 'extruder', description: 'Универсальная линия', color: 'indigo' },
  { id: 'rewinder-1', name: 'Перемотка', shortName: 'Перемот.', type: 'rewinder', description: 'Только крученый ротанг', color: 'orange' },
];

const STATUSES = {
  planned:     { label: 'План',     color: 'bg-slate-100 text-slate-700 border-slate-200',                        barColor: 'bg-slate-200',   icon: Clock },
  in_progress: { label: 'В работе', color: 'bg-amber-100 text-amber-700 border-amber-200 stripe-animated',        barColor: 'bg-amber-200',   icon: Zap },
  completed:   { label: 'Готово',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200',                   barColor: 'bg-emerald-200', icon: CheckCircle2 },
  issue:       { label: 'Стоп',     color: 'bg-red-100 text-red-700 border-red-200',                              barColor: 'bg-red-200',     icon: AlertCircle },
};

const CELL_WIDTH = 140;
const ROW_HEIGHT = 60;

export default function ProductionCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [ordersPanelOpen, setOrdersPanelOpen] = useState(true);
  const [showOrdersPicker, setShowOrdersPicker] = useState(false);

  // Drag & drop state
  const [draggedItem, setDraggedItem] = useState<{
    article: string;
    quantity: number;
    dealTitle: string;
    companyName: string;
  } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ lineId: string; dateStr: string } | null>(null);

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ProductionEvent | null>(null);

  const [formData, setFormData] = useState({
    recipeId: '', amount: '', endDate: '', notes: '',
    status: 'planned' as ProductionEvent['status'],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const eventsRes = await fetch(`${crmUrl('/production-events')}`, {
        headers: { ...authHeaders(false) }
      });
      if (eventsRes.ok) setEvents(await eventsRes.json());

      const recipesRes = await fetch(`${crmUrl('/recipes')}`, {
        headers: { ...authHeaders(false) }
      });
      if (recipesRes.ok) setRecipes(await recipesRes.json());

      const ordersRes = await fetch(`${crmUrl('/production-orders')}`, {
        headers: { ...authHeaders(false) }
      });
      if (ordersRes.ok) setProductionOrders(await ordersRes.json());
    } catch (e) {
      console.warn('Backend unreachable, using mock data', e);
      toast.info('Режим демо (сервер недоступен)');
      setRecipes([
        { id: 'REC-001', name: 'Ротанг Белый' },
        { id: 'REC-002', name: 'Ротанг Коричневый' },
        { id: 'REC-003', name: 'Ротанг Серый' },
      ]);
      setEvents([
        { id: 'mock-1', lineId: 'extruder-1', recipeId: 'REC-001', amount: '1200', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'in_progress', notes: 'Тестовое задание на несколько дней' },
        { id: 'mock-2', lineId: 'extruder-2', recipeId: 'REC-002', amount: '350', startDate: new Date(Date.now() + 86400000).toISOString(), endDate: new Date(Date.now() + 86400000 * 2).toISOString(), status: 'planned' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const daysInMonth = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  }), [currentDate]);

  const stats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthEvents = events.filter(e => { const s = parseISO(e.startDate); return s >= monthStart && s <= monthEnd; });
    return {
      totalKg: monthEvents.reduce((a, e) => a + (parseFloat(e.amount || '0') || 0), 0),
      activeTasks: events.filter(e => e.status === 'in_progress').length,
      completedTasks: monthEvents.filter(e => e.status === 'completed').length,
    };
  }, [events, currentDate]);

  const handleCellClick = (date: Date, lineId: string) => {
    setSelectedDate(date);
    setSelectedLine(lineId);
    setEditingEventId(null);
    setSelectedEvent(null);
    setFormData({ recipeId: '', amount: '', endDate: format(date, 'yyyy-MM-dd'), notes: '', status: 'planned' });
    setDialogMode('edit');
    setShowOrdersPicker(false);
    setIsDialogOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, event: ProductionEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDate(parseISO(event.startDate));
    setSelectedLine(event.lineId);
    setEditingEventId(event.id);
    setFormData({ recipeId: event.recipeId || '', amount: event.amount || '', endDate: event.endDate, notes: event.notes || '', status: event.status || 'planned' });
    setDialogMode('view');
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedLine) return;
    setSubmitting(true);
    try {
      const payload = { id: editingEventId, lineId: selectedLine, startDate: format(selectedDate, 'yyyy-MM-dd'), endDate: formData.endDate, recipeId: formData.recipeId, amount: formData.amount, notes: formData.notes, status: formData.status };
      const res = await fetch(`${crmUrl('/production-events')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save event');
      const data = await res.json();
      if (editingEventId) {
        setEvents(events.map(ev => ev.id === editingEventId ? data.event : ev));
        setSelectedEvent(data.event);
        toast.success('Задание обновлено');
        setDialogMode('view');
      } else {
        setEvents([...events, data.event]);
        toast.success('Задание создано');
        setIsDialogOpen(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEventId) return;
    if (!confirm('Удалить это задание?')) return;
    try {
      const res = await fetch(`${crmUrl(`/production-events/${editingEventId}`)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(false) },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setEvents(events.filter(ev => ev.id !== editingEventId));
      toast.success('Задание удалено');
      setIsDialogOpen(false);
    } catch (e) { toast.error('Ошибка удаления'); }
  };

  const handleDropOnCell = async (date: Date, lineId: string) => {
    if (!draggedItem) return;
    setSubmitting(true);
    try {
      const startStr = format(date, 'yyyy-MM-dd');
      const payload = {
        lineId,
        startDate: startStr,
        endDate: startStr,
        recipeId: draggedItem.article,
        amount: String(draggedItem.quantity),
        notes: `Из заказа: ${draggedItem.dealTitle}${draggedItem.companyName ? ` (${draggedItem.companyName})` : ''}`,
        status: 'planned',
      };
      const res = await fetch(`${crmUrl('/production-events')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setEvents(prev => [...prev, data.event]);
      const lineName = LINES.find(l => l.id === lineId)?.shortName || lineId;
      toast.success(`«${draggedItem.article}» → ${lineName}, ${format(date, 'd MMM', { locale: ru })}`);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка добавления задания');
    } finally {
      setSubmitting(false);
      setDraggedItem(null);
      setDragOverCell(null);
    }
  };

  const calculateTracks = (lineEvents: ProductionEvent[]) => {
    const sorted = [...lineEvents].sort((a, b) => {
      const d = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (d !== 0) return d;
      return (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) - (new Date(a.endDate).getTime() - new Date(a.startDate).getTime());
    });
    const tracks: Date[] = [];
    const positioned = sorted.map(event => {
      const start = parseISO(event.startDate); start.setHours(0,0,0,0);
      const end = parseISO(event.endDate); end.setHours(23,59,59,999);
      let ti = tracks.findIndex(te => te < start);
      if (ti === -1) { ti = tracks.length; tracks.push(end); } else { tracks[ti] = end; }
      return { ...event, trackIndex: ti };
    });
    return { events: positioned, height: Math.max(tracks.length, 1) };
  };

  // Derived detail values
  const line = LINES.find(l => l.id === selectedLine);
  const statusCfg = selectedEvent ? (STATUSES[selectedEvent.status] || STATUSES.planned) : STATUSES.planned;
  const recipeName = selectedEvent ? (recipes.find(r => r.id === selectedEvent.recipeId)?.name || selectedEvent.recipeId || 'Задание') : '';
  const eventDuration = selectedEvent ? differenceInDays(parseISO(selectedEvent.endDate), parseISO(selectedEvent.startDate)) + 1 : 0;

  const headerBg: Record<ProductionEvent['status'], string> = {
    planned:     'bg-slate-50 border-b border-slate-100',
    in_progress: 'bg-amber-50 border-b border-amber-100',
    completed:   'bg-emerald-50 border-b border-emerald-100',
    issue:       'bg-red-50 border-b border-red-100',
  };

  return (
    <div className="space-y-4 p-2 md:p-6 max-w-[100vw] mx-auto pb-20">
      <style>{`
        @keyframes move-stripes { 0% { background-position: 0 0; } 100% { background-position: 28px 0; } }
        .stripe-animated {
          background-image: repeating-linear-gradient(45deg,rgba(255,255,255,0.4),rgba(255,255,255,0.4) 10px,transparent 10px,transparent 20px);
          background-size: 28px 28px;
          animation: move-stripes 2s linear infinite;
        }
        .hide-scrollbar::-webkit-scrollbar { display:none; }
        .hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
        .drag-over-cell { background: rgba(124,58,237,0.12) !important; outline: 2px dashed #7c3aed; outline-offset: -2px; }
        .order-chip-draggable { cursor: grab; }
        .order-chip-draggable:active { cursor: grabbing; }
      `}</style>

      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
        <div className="px-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Factory className="h-5 w-5 md:h-8 md:w-8 text-slate-700" />
            Производство
          </h1>
        </div>
        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 px-1 hide-scrollbar">
          {[
            { label: 'План (кг)', value: stats.totalKg.toLocaleString(), icon: Scale, bg: 'bg-blue-50/50 border-blue-100', ibg: 'bg-blue-100 text-blue-600' },
            { label: 'В работе', value: `${stats.activeTasks} задач`, icon: Zap, bg: 'bg-amber-50/50 border-amber-100', ibg: 'bg-amber-100 text-amber-600' },
            { label: 'Готово', value: `${stats.completedTasks} задач`, icon: CheckCircle2, bg: 'bg-emerald-50/50 border-emerald-100', ibg: 'bg-emerald-100 text-emerald-600' },
          ].map(s => (
            <Card key={s.label} className={`min-w-[110px] md:min-w-[160px] ${s.bg} shadow-sm flex-shrink-0`}>
              <CardContent className="p-2 md:p-4 flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-3">
                <div className={`p-1.5 rounded-md ${s.ibg}`}>
                  <s.icon className="h-3 w-3 md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="hidden md:block text-xs text-slate-500 font-medium uppercase">{s.label}</p>
                  <p className="text-base md:text-xl font-bold text-slate-900">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-30 mx-1">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-bold text-sm md:text-lg text-center capitalize text-slate-800 w-36">{format(currentDate, 'LLLL yyyy', { locale: ru })}</div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar justify-center md:justify-end">
          {Object.entries(STATUSES).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1 whitespace-nowrap flex-shrink-0 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
              <div className={`w-2 h-2 rounded-full ${cfg.barColor}`} />
              <span className="text-[10px] md:text-xs text-slate-600 font-medium">{cfg.label}</span>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2">Сегодня</Button>
        </div>
      </div>

      {/* Production Orders Panel — always visible */}
      <div className="mx-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
              <ClipboardList className="w-4 h-4" />
            </div>
            <button
              className="text-sm font-semibold text-slate-800 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
              onClick={() => setOrdersPanelOpen(!ordersPanelOpen)}
            >
              Заказы из сделок
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${ordersPanelOpen ? 'rotate-180' : ''}`} />
            </button>
            {productionOrders.length > 0 && (
              <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {productionOrders.reduce((acc, o) => acc + o.items.length, 0)} позиций
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="text-[11px] text-slate-400 hover:text-violet-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-violet-50 font-medium"
          >
            <Loader2 className="w-3 h-3" /> Обновить
          </button>
        </div>

        <AnimatePresence>
          {ordersPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {productionOrders.length === 0 ? (
                <div className="border-t border-slate-100 px-4 py-6 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <ClipboardList className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Нет заказов из сделок в работе</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Сделки со статусом «В работе» и товарами появятся здесь автоматически
                  </p>
                </div>
              ) : (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {/* Drag hint */}
                  <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-violet-400" />
                    <p className="text-[11px] text-violet-600 font-medium">
                      Перетащите позицию на нужный день в таблице — задание создастся автоматически
                    </p>
                  </div>
                  {productionOrders.map(order => (
                    <div key={order.id} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{order.dealTitle}</p>
                          {order.companyName && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Link2 className="w-3 h-3" />{order.companyName}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={(e) => {
                              setDraggedItem({ article: item.article, quantity: item.quantity, dealTitle: order.dealTitle, companyName: order.companyName });
                              e.dataTransfer.effectAllowed = 'copy';
                              // ghost image
                              const ghost = document.createElement('div');
                              ghost.textContent = `${item.article} × ${item.quantity} кг`;
                              ghost.style.cssText = 'position:fixed;top:-100px;left:0;background:#7c3aed;color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;white-space:nowrap';
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, 0, 0);
                              setTimeout(() => document.body.removeChild(ghost), 0);
                            }}
                            onDragEnd={() => { setDraggedItem(null); setDragOverCell(null); }}
                            className="order-chip-draggable flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 text-xs hover:bg-violet-100 hover:border-violet-300 hover:shadow-sm transition-all select-none"
                          >
                            <GripVertical className="w-3 h-3 text-violet-300" />
                            <Package className="w-3 h-3 text-violet-500" />
                            <span className="font-semibold text-violet-800">{item.article || '—'}</span>
                            <span className="text-violet-500">× {item.quantity} кг</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drag active global hint */}
      {draggedItem && (
        <div className="mx-1 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 px-4 py-3 flex items-center gap-3 text-sm text-violet-700 font-medium animate-pulse">
          <ArrowDownToLine className="w-5 h-5 text-violet-500 shrink-0" />
          Перетащите <span className="font-bold bg-violet-100 px-2 py-0.5 rounded-md">{draggedItem.article} × {draggedItem.quantity} кг</span> на нужный день и линию ниже
        </div>
      )}

      {/* Gantt Timeline */}
      <Card className="overflow-hidden border-slate-200 shadow-xl bg-white mx-1 ring-1 ring-slate-900/5">
        <div className="overflow-x-auto touch-pan-x">
          <div style={{ minWidth: `${daysInMonth.length * CELL_WIDTH + 260}px` }} className="relative">
            
            {/* Date Header */}
            <div className="flex border-b border-slate-200 bg-slate-50/80 sticky top-0 z-20 backdrop-blur-sm">
              <div className="w-[260px] flex-shrink-0 p-4 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-30 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] flex items-center gap-2">
                <Factory className="h-5 w-5 text-slate-400" /><span>Оборудование</span>
              </div>
              <div className="flex">
                {daysInMonth.map(day => (
                  <div key={day.toISOString()} style={{ width: CELL_WIDTH }}
                    className={`text-center py-3 border-r border-slate-200/50 text-xs flex flex-col items-center justify-center ${isToday(day) ? 'bg-blue-50' : ''}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isToday(day) ? 'text-blue-600' : 'text-slate-400'}`}>
                      {format(day, 'EEEE', { locale: ru }).slice(0, 2)}
                    </div>
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${isToday(day) ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {LINES.map(ln => {
                const lineEvents = events.filter(e => e.lineId === ln.id);
                const { events: positionedEvents, height: trackCount } = calculateTracks(lineEvents);
                const rowMinHeight = Math.max(140, trackCount * (ROW_HEIGHT + 10) + 40);
                return (
                  <div key={ln.id} className="flex relative group bg-white hover:bg-slate-50/30 transition-colors">
                    {/* Left sticky header */}
                    <div className="w-[260px] flex-shrink-0 p-4 border-r border-slate-200 bg-white sticky left-0 z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2.5 rounded-xl shadow-sm ${ln.type === 'extruder' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                          {ln.type === 'extruder' ? <Factory className="h-6 w-6" /> : <RefreshCcw className="h-6 w-6" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base">{ln.name}</div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{ln.type === 'extruder' ? 'Экструзия' : 'Перемотка'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 pl-1">{ln.description}</div>
                      <Button variant="outline" size="sm" className="mt-4 w-full border-dashed text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50" onClick={() => handleCellClick(new Date(), ln.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />Добавить заказ
                      </Button>
                    </div>

                    {/* Timeline area */}
                    <div className="relative flex-1" style={{ height: rowMinHeight }}>
                      {/* Grid bg */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {daysInMonth.map(day => (
                          <div key={day.toISOString()} style={{ width: CELL_WIDTH }}
                            className={`h-full border-r border-slate-100/60 ${isToday(day) ? 'bg-blue-50/30' : ''} ${[0,6].includes(day.getDay()) ? 'bg-slate-50/40' : ''}`} />
                        ))}
                      </div>
                      {/* Clickable + droppable cells */}
                      <div className="absolute inset-0 flex z-0">
                        {daysInMonth.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const isOver = dragOverCell?.lineId === ln.id && dragOverCell?.dateStr === dateStr;
                          return (
                            <div
                              key={day.toISOString()}
                              style={{ width: CELL_WIDTH }}
                              className={`h-full cursor-pointer transition-colors group/cell ${isOver ? 'drag-over-cell' : 'hover:bg-blue-50/20'}`}
                              onClick={() => !draggedItem && handleCellClick(day, ln.id)}
                              onDragOver={(e) => {
                                if (!draggedItem) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                                setDragOverCell({ lineId: ln.id, dateStr });
                              }}
                              onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                  setDragOverCell(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropOnCell(day, ln.id);
                              }}
                            >
                              {isOver ? (
                                <div className="h-full w-full flex flex-col items-center justify-center gap-1">
                                  <ArrowDownToLine className="w-5 h-5 text-violet-500" />
                                  <span className="text-[10px] font-bold text-violet-600">{format(day, 'd MMM', { locale: ru })}</span>
                                </div>
                              ) : (
                                <div className="h-full w-full flex items-end justify-center pb-2 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Events */}
                      <div className="absolute inset-0 top-3 pointer-events-none">
                        <AnimatePresence>
                          {positionedEvents.map(event => {
                            const sc = STATUSES[event.status || 'planned'] || STATUSES.planned;
                            const rName = recipes.find(r => r.id === event.recipeId)?.name || event.recipeId || 'Задание';
                            const startDate = parseISO(event.startDate);
                            const endDate = parseISO(event.endDate);
                            const monthStart = startOfMonth(currentDate);
                            const duration = differenceInDays(endDate, startDate) + 1;
                            let offset = differenceInDays(startDate, monthStart);
                            let length = duration;
                            if (offset < 0) { length += offset; offset = 0; }
                            if (length <= 0 || offset > 31) return null;
                            return (
                              <motion.div
                                key={event.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.01, zIndex: 50 }}
                                style={{ left: offset * CELL_WIDTH + 4, width: Math.max(40, length * CELL_WIDTH - 8), top: event.trackIndex * (ROW_HEIGHT + 8), height: ROW_HEIGHT }}
                                className={`absolute rounded-xl border pointer-events-auto cursor-pointer shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between p-3 overflow-hidden ${sc.color}`}
                                onClick={(e) => handleEventClick(e, event)}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-bold text-slate-800 text-sm leading-tight line-clamp-1">{rName}</span>
                                  <sc.icon className="w-4 h-4 opacity-50 shrink-0" />
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="bg-white/60 px-2 py-0.5 rounded-md text-xs font-bold text-slate-800 shadow-sm backdrop-blur-md">{event.amount} кг</div>
                                  {duration > 1 && <div className="text-[10px] font-medium opacity-60">{duration} д</div>}
                                </div>
                                {event.status === 'in_progress' && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-200">
                                    <div className="h-full bg-amber-500 w-1/3 animate-pulse" />
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Unified Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={`${dialogMode === 'view' ? 'sm:max-w-[600px]' : 'sm:max-w-[500px]'} w-[95vw] p-0 rounded-2xl overflow-hidden`}>
          <DialogTitle className="sr-only">
            {dialogMode === 'view' ? (recipeName || 'Производственное задание') : 'Добавить задание'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {dialogMode === 'view' ? 'Просмотр и управление производственным заданием' : 'Создание нового производственного задания'}
          </DialogDescription>

          {/* ── VIEW MODE ── */}
          {dialogMode === 'view' && selectedEvent && (
            <div className="flex flex-col" style={{ maxHeight: '90vh' }}>
              {/* Colored header */}
              <div className={`p-5 flex-shrink-0 ${headerBg[selectedEvent.status] || headerBg.planned}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shadow-sm flex-shrink-0 ${line?.type === 'extruder' ? 'bg-white text-blue-600' : 'bg-white text-orange-600'}`}>
                      {line?.type === 'extruder' ? <Factory className="h-6 w-6" /> : <RefreshCcw className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{recipeName}</h2>
                      <p className="text-sm text-slate-500 mt-0.5">{line?.name}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusCfg.color.replace(' stripe-animated', '')}`}>
                    <statusCfg.icon className="w-3.5 h-3.5" />
                    {statusCfg.label}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[
                    { label: 'Объём', value: selectedEvent.amount || '—', unit: 'кг' },
                    { label: 'Длительность', value: String(eventDuration), unit: eventDuration === 1 ? 'день' : eventDuration < 5 ? 'дня' : 'дней' },
                  ].map(m => (
                    <div key={m.label} className="bg-white/80 rounded-xl p-3 text-center shadow-sm border border-white">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide mb-0.5">{m.label}</p>
                      <p className="text-lg font-bold text-slate-900">{m.value}</p>
                      <p className="text-[10px] text-slate-400">{m.unit}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1">
                {/* Dates */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 flex-1 border border-slate-100">
                      <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Начало</p>
                        <p className="text-sm font-semibold text-slate-800">{format(parseISO(selectedEvent.startDate), 'd MMMM yyyy', { locale: ru })}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 flex-1 border border-slate-100">
                      <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Конец</p>
                        <p className="text-sm font-semibold text-slate-800">{format(parseISO(selectedEvent.endDate), 'd MMMM yyyy', { locale: ru })}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedEvent.notes && (
                  <div className="px-5 pb-3">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                      <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700 leading-relaxed">{selectedEvent.notes}</p>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white flex-shrink-0">
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDeleteEvent}>
                  <Trash2 className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">Удалить</span>
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Закрыть</Button>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={() => setDialogMode('edit')}>
                    <Edit3 className="h-4 w-4 mr-1.5" />Редактировать
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── EDIT MODE ── */}
          {dialogMode === 'edit' && (
            <div className="p-4 sm:p-6">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${LINES.find(l => l.id === selectedLine)?.color === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {LINES.find(l => l.id === selectedLine)?.type === 'extruder' ? <Factory className="h-5 w-5" /> : <RefreshCcw className="h-5 w-5" />}
                  </div>
                  <div>
                    <DialogTitle>{editingEventId ? 'Редактировать задание' : 'Новое задание'}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-xs sm:text-sm">
                      {selectedDate ? format(selectedDate, 'd MMMM', { locale: ru }) : ''} — {LINES.find(l => l.id === selectedLine)?.name}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(STATUSES).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => setFormData({...formData, status: key as any})}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${formData.status === key ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      <cfg.icon className="h-4 w-4 mb-1" />{cfg.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Артикул (Продукт)</Label>
                      {productionOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowOrdersPicker(!showOrdersPicker)}
                          className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          Из заказов
                          <ChevronDown className={`w-3 h-3 transition-transform ${showOrdersPicker ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Order item picker */}
                    <AnimatePresence>
                      {showOrdersPicker && productionOrders.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="border border-violet-200 rounded-xl overflow-hidden bg-white mb-2 max-h-52 overflow-y-auto shadow-sm">
                            {productionOrders.map(order => (
                              <div key={order.id}>
                                <div className="px-3 py-1.5 bg-violet-50 border-b border-violet-100 sticky top-0">
                                  <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide truncate">{order.dealTitle}</p>
                                  {order.companyName && <p className="text-[10px] text-violet-400">{order.companyName}</p>}
                                </div>
                                {order.items.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        recipeId: item.article || '',
                                        amount: item.quantity ? String(item.quantity) : prev.amount,
                                      }));
                                      setShowOrdersPicker(false);
                                    }}
                                    className="w-full text-left flex items-center justify-between px-3 py-2.5 hover:bg-violet-50 border-b border-slate-50 last:border-0 transition-colors group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500" />
                                      <span className="text-sm font-semibold text-slate-800">{item.article || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-400">{item.quantity} кг</span>
                                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">↵ Выбрать</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative">
                      <Input placeholder="Например: A-101, RED-001" value={formData.recipeId}
                        onChange={e => setFormData({...formData, recipeId: e.target.value})} className="bg-white pl-8 h-10" />
                      <Package className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
                    </div>
                    {LINES.find(l => l.id === selectedLine)?.type === 'rewinder' && (
                      <p className="text-xs text-orange-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Для перемотки только крученый</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Объем (кг)</Label>
                      <div className="relative">
                        <Input placeholder="1000" value={formData.amount}
                          onChange={e => setFormData({...formData, amount: e.target.value})} className="bg-white pl-8 h-10" />
                        <Scale className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Завершение</Label>
                      <Input type="date" value={formData.endDate}
                        onChange={e => setFormData({...formData, endDate: e.target.value})}
                        min={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined} className="bg-white h-10" />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Заметки мастера</Label>
                    <Textarea placeholder="Особенности партии..." value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-white min-h-[60px]" />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex flex-row justify-between gap-2 mt-2">
                {editingEventId ? (
                  <Button variant="ghost" onClick={handleDeleteEvent} type="button" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Удалить</span>
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  {editingEventId
                    ? <Button variant="outline" size="sm" onClick={() => setDialogMode('view')}>← Назад</Button>
                    : <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                  }
                  <Button onClick={handleSubmit} size="sm" disabled={submitting} className="bg-slate-900 hover:bg-slate-800">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingEventId ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}