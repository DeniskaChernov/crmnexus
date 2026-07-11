import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { crm } from "@/lib/crmClient.ts";
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DollarSign, Users, TrendingUp, Sparkles, Target, Briefcase, Activity, Package, MoreHorizontal, Loader2 } from 'lucide-react';
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
import { Badge } from '../components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { toast } from 'sonner@2.0.3';
import { TodayTasksWidget } from '../components/crm/TodayTasksWidget';
import { getNotificationPermission, getNotificationPreference } from '../utils/pushNotifications';
import { startTaskNotifications, stopTaskNotifications } from '../utils/taskNotifications';
import { SugarHome, type SugarHomeProps } from '../components/dashboard/SugarHome';

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

  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  
  useEffect(() => {
    setMounted(true);
    fetchStats(timeRange, true);
    loadPlan();
    fetchWarehouseStats();
    fetchPipelines();
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

  useEffect(() => {
    crm.from('tasks').select('*').order('due_date', { ascending: true }).limit(20).then(({ data }) => {
      if (data) setAllTasks(data);
    });
  }, []);

  const sugarProps: SugarHomeProps = React.useMemo(() => {
    const tones: Array<'blue' | 'red' | 'orange'> = ['blue', 'red', 'blue', 'orange', 'blue', 'red', 'blue', 'orange'];
    const companyCounts = new Map<string, number>();
    for (const d of allDeals) {
      const name = d.companies?.name || d.title || 'Клиент';
      companyCounts.set(name, (companyCounts.get(name) || 0) + 1);
    }
    const team = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count], i) => ({
        id: `t-${i}`,
        name,
        count,
        tone: tones[i % tones.length]!,
      }));

    const openDeals = allDeals.filter((d) => d.status === 'open');
    const wonDeals = allDeals.filter((d) => d.status === 'won');

    const allocationTasks = openDeals.slice(0, 2).map((d) => ({
      id: d.id,
      title: `Назначить: ${d.title}`,
      assignee: d.companies?.name,
    }));

    const identificationTasks = openDeals.slice(2, 7).map((d, i) => ({
      id: d.id,
      title: `Квалификация: ${d.title}`,
      assignee: d.companies?.name,
      highlight: i === 2,
    }));

    const resolutionTasks = openDeals.slice(7, 11).map((d) => ({
      id: d.id,
      title: `Закрытие: ${d.title}`,
      assignee: d.companies?.name,
    }));

    const taskTitles = allTasks.length
      ? allTasks.slice(0, 6).map((t) => t.title)
      : ['Обработка заявки', 'Решение проблемы', 'Связь с клиентом', 'Тестирование', 'Документация', 'Согласование'];

    const newTasks = taskTitles.map((title, i) => ({
      id: `nt-${i}`,
      title,
      active: i === 0,
    }));

    const knowledgeRows = (allTasks.length ? allTasks : []).slice(0, 4).map((t) => ({
      id: t.id,
      subject: t.title,
      status: (t.status === 'done' || t.status === 'completed' ? 'executed' : 'scheduled') as 'executed' | 'scheduled',
      startDate: t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—',
      endDate: t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—',
      assignee: t.assignee || 'Менеджер',
    }));

    if (knowledgeRows.length === 0) {
      knowledgeRows.push(
        { id: '1', subject: 'Связаться с клиентом', status: 'executed', startDate: '11.07.2026', endDate: '11.07.2026', assignee: 'Менеджер' },
        { id: '2', subject: 'Подготовить КП', status: 'scheduled', startDate: '12.07.2026', endDate: '14.07.2026', assignee: 'Отдел продаж' },
      );
    }

    return {
      team: team.length ? team : [{ id: '0', name: 'Команда', count: openDeals.length, tone: 'blue' as const }],
      allocationTasks: allocationTasks.length ? allocationTasks : [{ id: 'a1', title: 'Назначить сделку менеджеру', assignee: 'CRM' }],
      identificationTasks: identificationTasks.length ? identificationTasks : [{ id: 'i1', title: 'Определить категорию сделки', assignee: 'CRM' }],
      resolutionTasks: resolutionTasks.length ? resolutionTasks : [{ id: 'r1', title: 'Оценить срок закрытия', assignee: 'CRM', highlight: true }],
      newTasks,
      knowledgeRows,
      executedCount: wonDeals.length,
      activeCount: openDeals.length,
      loading: false,
    };
  }, [allDeals, allTasks]);

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
        setAllDeals(deals);
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

  const targetPlan = monthlyPlan * periodDuration;
  const planProgress = targetPlan > 0 ? (stats.revenue / targetPlan) * 100 : 0;

  const FinancialWidget = () => {
    const profit = stats.revenue - stats.payroll;
    const data = [
        { name: 'ФОТ (Зарплаты)', value: stats.payroll, color: '#ef4444' },
        { name: 'Маржа', value: profit > 0 ? profit : 0, color: '#22c55e' }
    ];

    return (
        <Card className="nexus-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-indigo-50 ring-1 ring-indigo-100/80">
                    <DollarSign className="h-4 w-4 text-indigo-700" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">Финансы</h3>
                    <p className="text-xs text-slate-500">Оценка эффективности</p>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-[100px] h-[100px] relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={35}
                                outerRadius={50}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(value)}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className="text-[10px] font-bold text-slate-400">
                           {stats.revenue > 0 ? ((stats.payroll / stats.revenue) * 100).toFixed(0) : 0}%
                       </span>
                    </div>
                </div>
                <div className="space-y-2 flex-1 w-full">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Выручка</span>
                        <span className="font-bold text-slate-900">{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-violet-600" style={{ width: '100%' }}></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">ФОТ</span>
                        <span className="font-bold text-red-500">{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.payroll)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                         <div className="bg-red-500 h-full" style={{ width: `${Math.min(stats.revenue > 0 ? (stats.payroll / stats.revenue) * 100 : 0, 100)}%` }}></div>
                    </div>
                </div>
            </div>
        </Card>
    );
  };

  const WarehouseWidget = () => {
    if (!warehouseStats) return null;
    
    // Dynamically calculate totals for all warehouses
    const warehouses = Object.keys(warehouseStats);
    const totalStock = warehouses.reduce((sum, wh) => sum + (warehouseStats[wh]?.current.total || 0), 0);
    const totalProduced = warehouses.reduce((sum, wh) => sum + (warehouseStats[wh]?.produced.total || 0), 0);

    // Find Low Stock Items (Simple logic: lowest positive stock)
    const allItems: any[] = [];
    warehouses.forEach(wh => {
        if (warehouseStats[wh]?.current?.byArticle) {
            Object.entries(warehouseStats[wh].current.byArticle).forEach(([art, qty]: [string, any]) => {
                if (qty > 0 && qty < 100) { // Threshold 100kg
                    allItems.push({ art, qty, wh });
                }
            });
        }
    });
    const lowStock = allItems.sort((a, b) => a.qty - b.qty).slice(0, 3);

    return (
      <Card className="nexus-card">
        <CardHeader className="pb-2">
           <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
             <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200/80">
               <Package className="h-4 w-4 text-indigo-600" />
             </span>
             Склад
           </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
           <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-3 rounded-2xl ring-1 ring-slate-100">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Всего</p>
                  <p className="text-lg font-bold text-slate-900">{totalStock.toLocaleString()} кг</p>
               </div>
               <div className="bg-indigo-50/80 p-3 rounded-2xl ring-1 ring-indigo-100/60">
                  <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider mb-1">Производство</p>
                  <p className="text-lg font-bold text-indigo-800">{totalProduced.toLocaleString()} кг</p>
               </div>
           </div>
           
           {lowStock.length > 0 && (
               <div>
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                       <Activity className="h-3 w-3" /> Заканчивается
                   </p>
                   <div className="space-y-2">
                       {lowStock.map((item, i) => (
                           <div key={i} className="flex justify-between items-center text-xs border-b border-slate-50 pb-1 last:border-0">
                               <span className="font-medium text-slate-700">{item.art}</span>
                               <span className="font-bold text-red-600">{Number(item.qty).toFixed(2)} кг</span>
                           </div>
                       ))}
                   </div>
               </div>
           )}
        </CardContent>
      </Card>
    );
  };

  const FunnelWidget = () => (
    <Card className="nexus-card p-6 flex flex-col min-w-0 min-h-[300px]">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100/70">
          <Briefcase className="h-4 w-4 text-indigo-700" />
        </span>
        <h3 className="font-bold text-lg text-slate-900">Воронка</h3>
      </div>
      {funnelData.length > 0 ? (
          <div className="w-full min-w-0" style={{ height: 220 }}>
             {mounted && (
                 <ResponsiveContainer width="100%" height={220} minWidth={0} debounce={50}>
                    <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                         cursor={{fill: 'transparent'}}
                         contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }}
                         formatter={(value: number) => [value, 'Сделок']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#cbd5e1'} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
             )}
          </div>
      ) : (
          <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              Нет данных
          </div>
      )}
    </Card>
  );

  const ForecastWidget = () => (
    <Card className="nexus-card p-6">
       <div className="flex items-center gap-2 mb-3 text-slate-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100/80">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">Прогноз</span>
       </div>
       <div className="mb-4">
          <h3 className="text-3xl font-bold tracking-tight text-slate-900">
            {new Intl.NumberFormat('uz-UZ').format(forecast)}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Ожидаемая выручка</p>
       </div>
       <div className="space-y-2">
          {funnelData.slice(0, 3).map((stage, idx) => (
             <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{stage.name}</span>
                <span className="font-medium text-slate-900">
                    {new Intl.NumberFormat('uz-UZ').format(stage.value)}
                </span>
             </div>
          ))}
       </div>
    </Card>
  );

  const StatCard = ({ title, value, icon: Icon, trend, colorClass = "bg-white" }: any) => (
    <div className={`nexus-card p-6 flex flex-col justify-between min-h-[8.5rem] relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 ${colorClass}`}>
      <div className="flex justify-between items-start z-10">
         <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 ring-1 ring-indigo-100/70 flex items-center justify-center text-indigo-800 shadow-sm">
            <Icon className="w-5 h-5" />
         </div>
         {trend && (
             <div className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                 {trend > 0 ? '+' : ''}{trend}%
             </div>
         )}
      </div>
      <div className="z-10 mt-auto">
         <h3 className="text-2xl font-bold tracking-tight text-slate-900">{value}</h3>
         <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">{title}</p>
      </div>
    </div>
  );

  if (loading) {
    return <SugarHome {...sugarProps} loading />;
  }

  return <SugarHome {...sugarProps} />;
}
