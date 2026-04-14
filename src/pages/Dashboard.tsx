import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { crm } from "@/lib/crmClient.ts";
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DollarSign, Users, TrendingUp, Sparkles, Target, Briefcase, Activity, Package, ArrowRight, MoreHorizontal } from 'lucide-react';
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
import { requestNotificationPermission, getNotificationPermission } from '../utils/pushNotifications';
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

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  
  useEffect(() => {
    setMounted(true);
    fetchStats(timeRange);
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

    // Realtime subscription for deals changes
    const dealsChannel = crm
      .channel('dashboard-deals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals'
        },
        (payload) => {
          console.log('Deal changed, refreshing dashboard:', payload);
          fetchStats(timeRange);
        }
      )
      .subscribe();

    // Check for payments updates every 15 seconds
    const paymentsInterval = setInterval(() => {
      fetchStats(timeRange);
    }, 15000);

    return () => {
      clearInterval(warehouseInterval);
      clearInterval(paymentsInterval);
      crm.removeChannel(dealsChannel);
    };
  }, [timeRange]);

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
    const initNotifications = async () => {
      if (getNotificationPermission() === 'default') {
        await requestNotificationPermission();
      }
    };
    initNotifications();
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
             'AIKO': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
        });
      }
    } catch (e) {
      console.warn("Failed to fetch warehouse stats - Network error:", e);
      setWarehouseStats({
          'AIKO': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
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

  const fetchStats = async (currentRange: string) => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
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
        <Card className="soft-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-slate-900" />
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
                        <div className="bg-slate-900 h-full" style={{ width: '100%' }}></div>
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
      <Card className="soft-card">
        <CardHeader className="pb-2">
           <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
             <Package className="h-4 w-4 text-blue-500" />
             Склад
           </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
           <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Всего</p>
                  <p className="text-lg font-bold text-slate-900">{totalStock.toLocaleString()} кг</p>
               </div>
               <div className="bg-blue-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Производство</p>
                  <p className="text-lg font-bold text-blue-700">{totalProduced.toLocaleString()} кг</p>
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
    <Card className="soft-card p-6 flex flex-col min-w-0 min-h-[300px]">
      <h3 className="font-bold text-lg text-slate-900 mb-4">Воронка</h3>
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
    <Card className="soft-card p-6">
       <div className="flex items-center gap-2 mb-2 text-slate-500">
          <TrendingUp className="h-4 w-4 text-green-600" />
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
    <div className={`soft-card p-6 flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 ${colorClass}`}>
      <div className="flex justify-between items-start z-10">
         <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 shadow-sm">
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
    return <div className="flex items-center justify-center h-full text-slate-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-10">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Обзор</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
             <span>Статистика за</span>
             <Select value={timeRange} onValueChange={setTimeRange}>
               <SelectTrigger className="w-[140px] h-8 bg-transparent border-none font-bold text-slate-900 focus:ring-0 shadow-none px-0 gap-1 hover:text-slate-700">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent align="end">
                 <SelectItem value="this_month">Этот месяц</SelectItem>
                 <SelectItem value="last_month">Прошлый месяц</SelectItem>
                 <SelectItem value="this_year">Этот год</SelectItem>
                 <SelectItem value="all">Все время</SelectItem>
               </SelectContent>
             </Select>
          </div>
        </div>
        <div className="flex gap-3">
           <Button onClick={() => setAiOpen(true)} className="rounded-full bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50">
              <Sparkles className="w-4 h-4 mr-2" /> AI Assistant
           </Button>
           <Button onClick={() => setIsPlanDialogOpen(true)} className="rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20">
              <Target className="w-4 h-4 mr-2" /> Цель
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Выручка"
          value={new Intl.NumberFormat('uz-UZ').format(stats.revenue)}
          icon={DollarSign}
          trend={12}
        />
        <StatCard
          title="Сделки"
          value={stats.activeDeals}
          icon={Briefcase}
          trend={5}
        />
        <StatCard
          title="Лиды"
          value={stats.newLeads}
          icon={Users}
          trend={-2}
        />
        <StatCard
          title="Конверсия"
          value={`${stats.conversion.toFixed(1)}%`}
          icon={Activity}
          trend={8}
        />
      </div>

      {/* Main Content: Chart + Side Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Large Chart Card */}
         <div className="lg:col-span-2 space-y-6 min-w-0">
            <Card className="soft-card p-6 min-h-[350px]">
               <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="font-bold text-lg text-slate-900">Продажи</h3>
                      <p className="text-sm text-slate-500">Динамика выручки</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-slate-100"
                    onClick={() => toast.info('Фукционал экспорта данных в разработке')}
                    title="Дополнительные опции"
                  >
                      <MoreHorizontal className="h-5 w-5 text-slate-400" />
                  </Button>
               </div>
               <div className="h-[250px] w-full min-w-0" style={{ height: 250 }}>
                  {mounted && (
                      <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={50}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value), '']}
                          />
                          <Area type="monotone" dataKey="amount" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                  )}
               </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FunnelWidget />

               {/* Hot Deals List */}
               <Card className="soft-card p-6 h-full overflow-hidden min-h-[300px]">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="font-bold text-lg text-slate-900">Активные сделки</h3>
                     <Button variant="link" className="text-slate-500 hover:text-slate-900 p-0 h-auto text-xs">Все</Button>
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[240px] pr-2 custom-scrollbar">
                     {hotDeals.map((deal) => (
                         <div key={deal.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                   {deal.companies?.name?.[0] || '?'}
                                </div>
                                <div className="min-w-0">
                                   <p className="font-bold text-sm text-slate-900 truncate max-w-[100px]">{deal.title}</p>
                                   <p className="text-[10px] text-slate-500 truncate">{deal.companies?.name}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className="font-bold text-sm text-slate-900 block">{new Intl.NumberFormat('uz-UZ').format(deal.amount)}</span>
                             </div>
                         </div>
                     ))}
                  </div>
               </Card>
            </div>
         </div>

         {/* Right Sidebar Widgets */}
         <div className="space-y-6">
            
            <ForecastWidget />

            {/* Plan Card (Black Card from design) */}
            {monthlyPlan > 0 && (
                <Card className="soft-card p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-slate-100 rounded-full blur-3xl -mr-10 -mt-10"></div>
                   <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                         <div className="p-2 bg-slate-100 rounded-xl">
                            <Target className="h-5 w-5 text-slate-900" />
                         </div>
                         <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-900">
                            {planProgress.toFixed(0)}%
                         </span>
                      </div>
                      <h3 className="text-3xl font-bold mb-1 text-slate-900">{planProgress.toFixed(0)}%</h3>
                      <p className="text-slate-500 text-sm mb-6">Выполнение плана</p>
                      
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                         <div className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${Math.min(planProgress, 100)}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                         <span>0</span>
                         <span>{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(targetPlan)}</span>
                      </div>
                   </div>
                </Card>
            )}

            <TodayTasksWidget />
            <WarehouseWidget />
         </div>

      </div>

      {/* Plan Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="soft-card max-w-sm p-6">
          <DialogHeader>
            <DialogTitle>Цель продаж</DialogTitle>
            <DialogDescription>Установите финансовую цель.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label className="text-xs font-bold uppercase text-slate-400">Сумма (UZS)</Label>
               <Input 
                  value={planInput} 
                  onChange={(e) => setPlanInput(e.target.value)}
                  className="bg-slate-50 border-none h-12 text-lg font-bold" 
               />
            </div>
            <Button onClick={savePlan} className="w-full bg-black text-white h-12 rounded-xl hover:bg-slate-800">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="soft-card max-w-2xl p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
             <DialogTitle className="flex items-center gap-2">
               <Sparkles className="w-5 h-5 text-purple-600" />
               AI Insights
             </DialogTitle>
             <DialogDescription className="text-sm text-slate-500 mt-1">
               Анализ текущих показателей и рекомендации
             </DialogDescription>
          </div>
          <div className="p-8 bg-slate-50/50 min-h-[300px]">
             {aiLoading ? (
                 <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                    <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div>
                    <p className="text-sm font-medium">Analyzing data...</p>
                 </div>
             ) : (
                 <div className="prose prose-slate max-w-none">
                    {aiResult || <div className="text-center text-slate-400 py-10">Нажмите "AI Анализ" для получения отчета</div>}
                 </div>
             )}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
             <Button onClick={runAIAnalysis} disabled={aiLoading} className="bg-black text-white rounded-xl px-6">
                {aiLoading ? 'Thinking...' : 'Анализировать'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}