import React, { useEffect, useMemo, useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { crm } from "@/lib/crmClient.ts";
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner@2.0.3';
import { BttCrmHome, facesFromNames, type BttCrmFlowTask, type BttCrmGanttItem } from '../components/dashboard/BttCrmHome.tsx';
import { getNotificationPermission, getNotificationPreference } from '../utils/pushNotifications';
import { startTaskNotifications, stopTaskNotifications } from '../utils/taskNotifications';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('this_month');
  const [stats, setStats] = useState({
    revenue: 0,
    activeDeals: 0,
    newLeads: 0,
    conversion: 0,
    payroll: 0,
  });
  const [periodDuration, setPeriodDuration] = useState(1);
  const [chartData, setChartData] = useState<any[]>([]);
  const [hotDeals, setHotDeals] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [forecast, setForecast] = useState(0);
  const [loading, setLoading] = useState(true);
  const [monthlyPlan, setMonthlyPlan] = useState<number>(0);
  const [planInput, setPlanInput] = useState<string>('');
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [warehouseStats, setWarehouseStats] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [scheduleItems, setScheduleItems] = useState<{ id: string; title: string; startDay: number; duration: number }[]>([]);
  const [crmTasks, setCrmTasks] = useState<any[]>([]);
  const [allCrmTasks, setAllCrmTasks] = useState<any[]>([]);
  
  useEffect(() => {
    setMounted(true);
    fetchStats(timeRange, true);
    loadPlan();
    fetchWarehouseStats();
    fetchPipelines();
    fetchTeamMembers();
    fetchScheduleItems();
  }, [timeRange]);

  // Auto-refresh data and realtime subscription
  useEffect(() => {
    // Refresh every 30 seconds for warehouse stats
    const warehouseInterval = setInterval(() => {
      fetchWarehouseStats();
    }, 30000);

    const dealsInterval = setInterval(() => {
      fetchStats(timeRange);
    }, 30000);

    return () => {
      clearInterval(warehouseInterval);
      clearInterval(dealsInterval);
    };
  }, [timeRange]);

  const fetchScheduleItems = async () => {
    try {
      const { data, error } = await crm.from('tasks').select('*');
      if (error || !Array.isArray(data)) return;
      const colors = ['#d4f534', '#111111', '#a3e635', '#facc15', '#38bdf8'];
      setAllCrmTasks(data);
      const items: { id: string; title: string; startDay: number; duration: number; color?: string }[] = data
        .filter((t: any) => t.status !== 'done' && t.status !== 'completed')
        .slice(0, 6)
        .map((t: any, i: number) => {
          const due = t.dueDate ? new Date(t.dueDate) : new Date();
          const day = (due.getDay() + 6) % 7;
          return {
            id: String(t.id),
            title: String(t.title || 'Задача'),
            startDay: day,
            duration: Math.min(3, 7 - day),
            color: colors[i % colors.length],
          };
        });
      setScheduleItems(items);
      setCrmTasks(data.filter((t: any) => t.status !== 'done' && t.status !== 'completed'));
    } catch {
      /* ignore */
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`${crmUrl('/employees')}`, { headers: { ...authHeaders(false) } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTeamMembers(
            data
              .filter((e: any) => e.active !== false)
              .slice(0, 8)
              .map((e: any) => ({ id: String(e.id), name: String(e.name || 'Сотрудник') })),
          );
        }
      }
    } catch {
      /* ignore */
    }
  };

  const fetchPipelines = async () => {
    try {
        const response = await fetch(`${crmUrl('/pipelines')}`, {
            headers: { ...authHeaders(false) }
        });
        if (response.ok) {
            const data = await response.json();
            setPipelines(data);
            const defaultPipeline = data.find((p: any) => p.isDefault) || data[0];
            if (defaultPipeline) {
                setStages(defaultPipeline.stages || []);
            } else {
                setStages([
                    { id: 's1', name: 'Новая', color: '#94a3b8' },
                    { id: 's2', name: 'В работе', color: '#60a5fa' },
                    { id: 's3', name: 'Оплата', color: '#4ade80' },
                ]);
            }
        } else {
             throw new Error("Failed to fetch pipelines");
        }
    } catch (e) {
        console.warn("Failed to fetch pipelines", e);
        // Fallback
        setStages([
            { id: 's1', name: 'Новая', color: '#94a3b8' },
            { id: 's2', name: 'В работе', color: '#60a5fa' },
            { id: 's3', name: 'Оплата', color: '#4ade80' },
        ]);
    }
  };

  // Initialize task notifications
  useEffect(() => {
    if (getNotificationPermission() !== 'granted' || !getNotificationPreference()) {
      return;
    }
    const interval = startTaskNotifications(10);
    return () => {
      if (interval) stopTaskNotifications(interval);
    };
  }, []);

  const loadPlan = async () => {
    try {
      const response = await fetch(
        `${crmUrl('/sales-plan')}`,
        { headers: { ...authHeaders(false) } }
      );
      if (!response.ok) return;
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await response.json();
      if (data.plan) {
        setMonthlyPlan(data.plan);
        setPlanInput(data.plan.toString());
      }
    } catch (e) {
        console.warn('Failed to load plan', e);
    }
  };

  const fetchWarehouseStats = async () => {
    try {
      const response = await fetch(`${crmUrl('/warehouse/inventory')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouseStats(data);
      } else {
        const errorData = await response.text();
        console.warn("Failed to fetch warehouse stats - HTTP", response.status, errorData);
        setWarehouseStats({
             'BTT': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
        });
      }
    } catch (e) {
      console.warn("Failed to fetch warehouse stats - Network error:", e);
      setWarehouseStats({
          'BTT': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
      });
    }
  };

  const savePlan = async () => {
    const plan = parseFloat(planInput);
    if (isNaN(plan) || plan < 0) {
      toast.error('Введите корректную сумму');
      return;
    }
    try {
      const response = await fetch(
        `${crmUrl('/sales-plan')}`,
        {
          method: 'POST',
          headers: { ...authHeaders() },
          body: JSON.stringify({ plan }),
        }
      );
      if (response.ok) {
        setMonthlyPlan(plan);
        setIsPlanDialogOpen(false);
        toast.success('План сохранён');
      } else {
        toast.error('Ошибка сохранения');
      }
    } catch (e) {
      toast.error('Ошибка сети');
    }
  };

  const fetchStats = async (currentRange: string, showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      setDashboardError('');
      // 1. Fetch raw deals
      const { data: rawDeals } = await crm.from('deals').select('*, companies(name)');

      // 2. Fetch excluded metadata
      let excludedIds = new Set();
      try {
          const metaResponse = await fetch(`${crmUrl('/deals/excluded')}`, {
            headers: { ...authHeaders(false) }
          });
          const metaData = metaResponse.ok ? await metaResponse.json() : { excludedIds: [] };
          excludedIds = new Set(metaData.excludedIds || []);
      } catch (e) {
          console.warn("Failed to fetch excluded metadata", e);
      }

      // 3. Filter excluded deals
      const deals = rawDeals?.filter(d => !excludedIds.has(d.id)) || [];

      // Fetch payments from server
      let allPayments: any[] = [];
      try {
          const paymentsResponse = await fetch(`${crmUrl('/payments')}`, {
            headers: { ...authHeaders(false) }
          });
          
          if (paymentsResponse.ok) {
            allPayments = await paymentsResponse.json();
          } else {
            const errorText = await paymentsResponse.text();
            console.warn("Failed to fetch payments - HTTP", paymentsResponse.status, errorText);
          }
      } catch (e) {
          console.warn("Failed to fetch payments - Network", e);
      }

      // Filter payments: Only include payments for valid (non-excluded) deals
      allPayments = allPayments.filter((p: any) => deals.some(d => d.id === p.dealId));

      if (deals) {
        // Calculate Period Duration
        let duration = 1;
        if (currentRange === 'this_year') duration = 12;
        else if (currentRange === 'all' && deals.length > 0) {
            const dates = deals.map(d => new Date(d.created_at).getTime());
            const minDate = new Date(Math.min(...dates));
            const now = new Date();
            duration = (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth()) + 1;
            if (duration < 1) duration = 1;
        }
        setPeriodDuration(duration);

        // Filter Deals
        const now = new Date();
        const filteredDeals = deals.filter(d => {
            const date = new Date(d.created_at);
            if (currentRange === 'all') return true;
            if (currentRange === 'this_month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            if (currentRange === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
            }
            if (currentRange === 'this_year') return date.getFullYear() === now.getFullYear();
            return true;
        });

        // Filter payments by date range
        const filteredPayments = allPayments.filter((p: any) => {
            const date = new Date(p.date);
            if (currentRange === 'all') return true;
            if (currentRange === 'this_month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            if (currentRange === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
            }
            if (currentRange === 'this_year') return date.getFullYear() === now.getFullYear();
            return true;
        });

        const openDeals = filteredDeals.filter(d => d.status === 'open');
        const wonDeals = filteredDeals.filter(d => d.status === 'won');
        
        // Calculate ACTUAL revenue from payments (not contract amounts)
        const totalRevenue = filteredPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        
        const conversionRate = filteredDeals.length > 0 ? (wonDeals.length / filteredDeals.length) * 100 : 0;

        const allOpenDeals = deals.filter(d => d.status === 'open');
        const hotDealsData = allOpenDeals
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5);

        setStats({
          revenue: totalRevenue,
          activeDeals: allOpenDeals.length,
          newLeads: filteredDeals.length,
          conversion: conversionRate,
          payroll: 0, // Add payroll calculation here if needed
        });

        setHotDeals(hotDealsData);

        // --- FUNNEL & FORECAST CALCULATION ---
        if (stages.length > 0) {
            // Map stages to funnel
            const funnel = stages.map(stage => {
                const stageDeals = deals.filter(d => d.stage_id === stage.id && d.status === 'open');
                const count = stageDeals.length;
                const value = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
                return {
                    name: stage.name,
                    count,
                    value,
                    color: stage.color || '#cbd5e1'
                };
            });
            setFunnelData(funnel);

            // Calculate Forecast (Weighted Pipeline)
            const forecastValue = stages.reduce((acc, stage, index) => {
                const stageDeals = deals.filter(d => d.stage_id === stage.id && d.status === 'open');
                const stageValue = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
                
                // Simple Probability Model based on order
                // 1st stage: 10%, Last stage: 90%
                const prob = Math.round(((index + 1) / stages.length) * 0.9 * 100) / 100;
                return acc + (stageValue * prob);
            }, 0);
            setForecast(forecastValue);
        }

        // Chart Data - use payments instead of deal amounts
        let chartDataPoints: any[] = [];
        if (currentRange === 'this_month' || currentRange === 'last_month') {
             const targetDate = currentRange === 'this_month' ? new Date() : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
             const year = targetDate.getFullYear();
             const month = targetDate.getMonth();
             const daysInMonth = new Date(year, month + 1, 0).getDate();
             for (let i = 1; i <= daysInMonth; i++) {
                 chartDataPoints.push({
                     dateKey: i,
                     month: `${i}`, 
                     amount: 0
                 });
             }
             filteredPayments.forEach((payment: any) => {
                 const d = new Date(payment.date);
                 const day = d.getDate();
                 if (chartDataPoints[day - 1]) chartDataPoints[day - 1].amount += payment.amount || 0;
             });
        } else {
            const monthlyDataMap = new Map();
            if (currentRange === 'this_year') {
                for (let i = 0; i < 12; i++) {
                    const d = new Date(new Date().getFullYear(), i, 1);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = d.toLocaleDateString('ru-RU', { month: 'short' });
                    monthlyDataMap.set(key, { month: label, amount: 0, sortKey: key });
                }
            }
            filteredPayments.forEach((payment: any) => {
                const d = new Date(payment.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyDataMap.has(key)) {
                     const label = d.toLocaleDateString('ru-RU', { 
                         month: 'short', 
                         year: currentRange === 'all' ? '2-digit' : undefined 
                     });
                     monthlyDataMap.set(key, { month: label, amount: 0, sortKey: key });
                }
                monthlyDataMap.get(key).amount += payment.amount || 0;
            });
            chartDataPoints = Array.from(monthlyDataMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        }
        setChartData(chartDataPoints);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setDashboardError('Не удалось обновить показатели. Проверьте подключение к API и попробуйте ещё раз.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
      if (stages.length > 0) {
          fetchStats(timeRange);
      }
  }, [stages]);


  const runAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const response = await fetch(
        `${crmUrl('/ai-insights')}`,
        {
          method: 'POST',
          headers: { ...authHeaders() },
          body: JSON.stringify({ stats, hotDeals }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAiResult(data.insights || 'Анализ завершён');
      } else {
        setAiResult('Не удалось получить аналитику');
      }
    } catch (e) {
      setAiResult('Ошибка подключения к AI');
    } finally {
      setAiLoading(false);
    }
  };

  const flowColumns = useMemo(() => {
    const toFlow = (t: any, i: number): BttCrmFlowTask => ({
      id: String(t.id),
      title: String(t.title || t.name || 'Задача'),
      subtitle: String(t.dealTitle || t.relatedTo || t.companies?.name || 'Заказ клиента'),
      face: facesFromNames([t.assigneeName || t.title || 'З'])[0] || '·',
    });
    const tasks = crmTasks.length
      ? crmTasks
      : hotDeals.slice(0, 12).map((d: any) => ({
          id: d.id,
          title: d.title,
          companies: d.companies,
        }));
    const chunk = (arr: any[], n: number) => {
      if (!arr.length) return Array.from({ length: n }, () => [] as any[]);
      const size = Math.ceil(arr.length / n);
      return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size));
    };
    const [c1, c2, c3] = chunk(tasks, 3);
    return [
      { title: 'Распределение', tasks: c1.map(toFlow) },
      { title: 'Проверка заказа', tasks: c2.map(toFlow) },
      { title: 'Выполнение', tasks: c3.map(toFlow) },
      { title: 'Следующие этапы', tasks: [] },
    ];
  }, [crmTasks, hotDeals]);

  const ganttItems: BttCrmGanttItem[] = useMemo(() => {
    return scheduleItems.slice(0, 4).map((s, i) => ({
      id: s.id,
      label: `${s.title}　${s.duration} дн.`,
      left: 8 + s.startDay * 11,
      top: 14 + i * 22,
      width: Math.min(55, Math.max(18, s.duration * 14)),
    }));
  }, [scheduleItems]);

  const teamFaces = useMemo(
    () => facesFromNames(teamMembers.map((m) => m.name)),
    [teamMembers],
  );

  const completedTasksCount = useMemo(
    () => allCrmTasks.filter((t) => t.status === 'done' || t.status === 'completed').length,
    [allCrmTasks],
  );

  const chartBars = useMemo(() => {
    const slice = chartData.slice(-12);
    if (!slice.length) return Array(12).fill(8);
    const max = Math.max(...slice.map((p) => p.amount || 0), 1);
    return slice.map((p) => Math.round(((p.amount || 0) / max) * 100));
  }, [chartData]);

  const { calendarMarkedDays, calendarBusyDays } = useMemo(() => {
    const now = new Date();
    const marked = new Set<number>();
    const busy = new Set<number>();
    for (const t of crmTasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        marked.add(d.getDate());
      }
    }
    for (const d of hotDeals) {
      if (!d.created_at) continue;
      const dt = new Date(d.created_at);
      if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) {
        busy.add(dt.getDate());
      }
    }
    return { calendarMarkedDays: [...marked], calendarBusyDays: [...busy] };
  }, [crmTasks, hotDeals]);

  const nextTaskLabel = useMemo(() => {
    const sorted = [...crmTasks]
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const next = sorted[0];
    if (!next?.dueDate) return undefined;
    const due = new Date(next.dueDate);
    const time = due.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${time} · ${String(next.title || 'Задача').slice(0, 18)}`;
  }, [crmTasks]);

  const warehouseStock = warehouseStats?.BTT?.current?.total ?? 0;
  if (loading) {
    return (
      <div className="btt-crm-body min-h-[40vh] flex flex-col items-center justify-center gap-3 text-[#747a74]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#171817' }} />
        <p className="text-sm">Загружаем показатели…</p>
      </div>
    );
  }

  return (
    <>
      <BttCrmHome
        activeTasksCount={crmTasks.length}
        completedTasksCount={completedTasksCount}
        openDealsCount={stats.activeDeals}
        revenue={stats.revenue}
        teamCount={teamMembers.length}
        teamFaces={teamFaces}
        flowColumns={flowColumns}
        ganttItems={ganttItems}
        chartBars={chartBars}
        calendarMarkedDays={calendarMarkedDays}
        calendarBusyDays={calendarBusyDays}
        notificationCount={crmTasks.length}
        nextTaskLabel={nextTaskLabel}
        warehouseStock={warehouseStock}
        dashboardError={dashboardError}
        onNewBoard={() => setIsPlanDialogOpen(true)}
        onOpenAi={() => {
          setAiOpen(true);
          if (!aiResult) void runAIAnalysis();
        }}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="max-w-sm p-6 border-0 rounded-[1.75rem]" style={{ background: '#fafbf8' }}>
          <DialogHeader>
            <DialogTitle>Цель продаж</DialogTitle>
            <DialogDescription>Месячная сумма в UZS для отслеживания прогресса.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label className="text-xs font-bold uppercase text-neutral-400">Сумма (UZS)</Label>
               <Input 
                  value={planInput} 
                  onChange={(e) => setPlanInput(e.target.value)}
                  className="border-0 bg-neutral-100 h-12 text-lg font-bold rounded-full px-5 focus-visible:ring-[var(--tasklab-lime)]/50" 
               />
            </div>
            <Button onClick={savePlan} className="w-full h-12 rounded-[14px] font-bold" style={{ background: '#dafa58' }}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="tasklab-card max-w-2xl p-0 overflow-hidden border-0">
          <div className="p-6 border-b border-neutral-100">
             <DialogTitle className="flex items-center gap-2 text-neutral-900">
               <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-[var(--tasklab-lime)] shadow-sm">
                 <Sparkles className="w-5 h-5" />
               </span>
               AI-инсайты
             </DialogTitle>
             <DialogDescription className="text-sm text-neutral-600 mt-2 pl-[3.25rem]">
               Краткий разбор текущих показателей и идей по продажам
             </DialogDescription>
          </div>
          <div className="p-6 md:p-8 bg-neutral-50 min-h-[280px]">
             {aiLoading ? (
                 <div className="flex flex-col items-center justify-center min-h-[240px] gap-4 text-neutral-500">
                    <Loader2 className="h-9 w-9 animate-spin text-neutral-900" />
                    <p className="text-sm font-medium">Анализируем данные…</p>
                 </div>
             ) : (
                 <div className="prose prose-neutral max-w-none prose-headings:text-neutral-900">
                    {aiResult || <div className="text-center text-neutral-400 py-10">Нажмите «Анализировать», чтобы получить отчёт</div>}
                 </div>
             )}
          </div>
          <div className="p-4 bg-white border-t border-neutral-100 flex justify-end gap-2">
             <Button variant="outline" onClick={() => setAiOpen(false)} className="tasklab-pill border-neutral-200">Закрыть</Button>
             <Button onClick={runAIAnalysis} disabled={aiLoading} className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800">
                {aiLoading ? 'Подождите…' : 'Анализировать'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
