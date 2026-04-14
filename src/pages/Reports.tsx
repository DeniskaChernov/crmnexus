import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { crm } from "@/lib/crmClient.ts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Calendar,
  BarChart3,
  PieChart,
  Users,
  Award,
  Download,
  Sparkles,
  Info,
  HelpCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Lightbulb,
  GraduationCap
} from 'lucide-react';
import { downloadCSV, formatDateForExport, formatCurrencyForExport } from '../utils/exportUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet';

interface SalesPlan {
  month: string;
  target: number;
}

export default function Reports() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Plan State
  const [monthlyPlan, setMonthlyPlan] = useState<number>(0);
  const [planInput, setPlanInput] = useState<string>('');
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  
  // Sales Data
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [avgDealSize, setAvgDealSize] = useState(0);

  // Advanced Stats ("Plushes")
  const [projectedRevenue, setProjectedRevenue] = useState(0);
  const [revenueGrowth, setRevenueGrowth] = useState(0); // vs last month
  const [dealsGrowth, setDealsGrowth] = useState(0); // vs last month
  const [dayOfWeekData, setDayOfWeekData] = useState<any[]>([]);
  const [scatterData, setScatterData] = useState<any[]>([]);
  
  // Charts Data
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any[]>([]); // New for Finance Tab
  const [stageData, setStageData] = useState<any[]>([]);
  const [topDeals, setTopDeals] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  
  // Date Filter State
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);
  
  // Metric Info Dialog State
  const [metricInfoOpen, setMetricInfoOpen] = useState<string | null>(null);
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    setMounted(true);
    loadReports();
    loadPlan();
  }, []);

  useEffect(() => {
    if (isCustomDateRange && dateFrom && dateTo) {
      loadReports();
    }
  }, [dateFrom, dateTo, isCustomDateRange]);

  const loadPlan = async () => {
    try {
      const response = await fetch(
        `${crmUrl('/sales-plan')}`,
        {
          headers: { ...authHeaders(false) }
        }
      );
      
      const data = await response.json();
      if (data.plan) {
        setMonthlyPlan(data.plan);
        setPlanInput(data.plan.toString());
      }
    } catch (error) {
      console.error('Error loading sales plan:', error);
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
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({ plan })
        }
      );

      if (!response.ok) throw new Error('Failed to save plan');
      
      setMonthlyPlan(plan);
      setIsPlanDialogOpen(false);
      toast.success('План продаж сохранен');
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Ошибка сохранения плана');
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      // CHANGED: Default startDate to 1970 (Effectively "All Time") instead of startOfYear
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
      const allTimeStart = new Date(0).toISOString(); // 1970-01-01

      // Determine date range
      // Default to ALL TIME unless custom range is set
      let startDate = allTimeStart; 
      let endDate = now.toISOString();
      
      if (isCustomDateRange && dateFrom && dateTo) {
        startDate = new Date(dateFrom).toISOString();
        endDate = new Date(dateTo).toISOString();
      }

      // 1. Total Revenue (Won deals) with date filter
      let wonDealsQuery = crm
        .from('deals')
        .select('amount, created_at, title, companies(name)')
        .eq('status', 'won')
        .order('amount', { ascending: false });

      if (isCustomDateRange && dateFrom && dateTo) {
        wonDealsQuery = wonDealsQuery
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      }

      // Parallel Fetch: Deals + Payments
      const [dealsResponse, paymentsResponse] = await Promise.all([
        wonDealsQuery,
        fetch(`${crmUrl('/payments')}`, {
            headers: { ...authHeaders(false) }
        })
      ]);

      const wonDeals = dealsResponse.data;
      const allPayments = paymentsResponse.ok ? await paymentsResponse.json() : [];

      const total = wonDeals?.reduce((sum, deal) => sum + (deal.amount || 0), 0) || 0;
      setTotalRevenue(total);

      // 2. Monthly Revenue (Current Month)
      const monthlyWon = wonDeals?.filter(d => 
        new Date(d.created_at) >= new Date(startOfMonth)
      ) || [];
      const monthlyTotal = monthlyWon.reduce((sum, deal) => sum + (deal.amount || 0), 0);
      setMonthlyRevenue(monthlyTotal);

      // --- PLUSHER FEATURES START ---

      // 2.1 Previous Month Comparison (Growth)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const lastMonthWon = wonDeals?.filter(d => {
        const date = new Date(d.created_at);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      }) || [];
      
      const lastMonthTotal = lastMonthWon.reduce((sum, d) => sum + (d.amount || 0), 0);
      
      // Calculate Revenue Growth
      if (lastMonthTotal > 0) {
        setRevenueGrowth(((monthlyTotal - lastMonthTotal) / lastMonthTotal) * 100);
      } else {
        setRevenueGrowth(monthlyTotal > 0 ? 100 : 0);
      }

      // Calculate Deals Count Growth
      if (lastMonthWon.length > 0) {
        setDealsGrowth(((monthlyWon.length - lastMonthWon.length) / lastMonthWon.length) * 100);
      } else {
        setDealsGrowth(monthlyWon.length > 0 ? 100 : 0);
      }

      // 2.2 Projected Revenue (Professional Weighted Forecast)
      // This uses a complex formula: Current Revenue + (Pipeline for Month * Historical Win Rate)
      const dayOfMonth = now.getDate();
      try {
        const startOfSixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        // 1. Calculate Historical Win Rate (Last 6 Months)
        const { data: historicalDeals } = await crm
          .from('deals')
          .select('amount, status')
          .in('status', ['won', 'lost'])
          .gte('created_at', startOfSixMonthsAgo);

        let historicalWinRate = 0.0;
        if (historicalDeals && historicalDeals.length > 0) {
          const wonAmount = historicalDeals
            .filter(d => d.status === 'won')
            .reduce((sum, d) => sum + (d.amount || 0), 0);
          const totalClosedAmount = historicalDeals
            .reduce((sum, d) => sum + (d.amount || 0), 0);
          
          if (totalClosedAmount > 0) {
            historicalWinRate = wonAmount / totalClosedAmount;
          }
        }

        // If no history, default to conservative 20%
        if (historicalWinRate === 0) historicalWinRate = 0.2;

        // 2. Get Open Pipeline for Current Month
        // Deals expected to close this month
        const { data: pipelineDeals } = await crm
          .from('deals')
          .select('amount')
          .eq('status', 'open')
          .gte('expected_close_date', startOfMonth)
          .lte('expected_close_date', endOfMonth);

        const pipelineValue = pipelineDeals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

        // 3. Calculate Weighted Forecast
        // Forecast = Accumulated Revenue + (Pipeline * Win Rate)
        // We also average it with Linear Run Rate for stability if early in month
        const weightedForecast = monthlyTotal + (pipelineValue * historicalWinRate);
        
        // Linear Run Rate (Backup/Stabilizer)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const runRate = dayOfMonth > 0 ? (monthlyTotal / dayOfMonth) * daysInMonth : 0;

        // Smart Logic:
        // If we are at end of month (>20th), rely heavily on Pipeline + Revenue
        // If beginning of month (<10th), rely more on Run Rate (historical velocity)
        // Mid month: Blend them
        let finalForecast = 0;
        
        if (dayOfMonth > 20) {
          finalForecast = weightedForecast;
        } else if (dayOfMonth < 10) {
          // 70% Run Rate, 30% Weighted Pipeline (to account for deals not yet created/scheduled)
          finalForecast = (runRate * 0.7) + (weightedForecast * 0.3);
        } else {
          // Blend 50/50
          finalForecast = (runRate * 0.5) + (weightedForecast * 0.5);
        }

        setProjectedRevenue(Math.round(finalForecast));

      } catch (e) {
        console.error('Professional forecast failed', e);
        // Fallback to simple run rate
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (dayOfMonth > 0) {
           setProjectedRevenue(Math.round((monthlyTotal / dayOfMonth) * daysInMonth));
        }
      }

      // 2.3 Best Selling Days (Day of Week Analysis)
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      const dayCounts = new Array(7).fill(0).map((_, i) => ({ day: days[i], value: 0, count: 0 }));
      
      wonDeals?.forEach(deal => {
        const dayIndex = new Date(deal.created_at).getDay();
        dayCounts[dayIndex].value += deal.amount || 0;
        dayCounts[dayIndex].count += 1;
      });
      setDayOfWeekData(dayCounts);

      // 2.4 Scatter Plot Data (Deal Size vs Time)
      // Limit to last 50 deals to avoid clutter
      const scatterPoints = wonDeals?.slice(0, 50).map((deal, i) => ({
        x: new Date(deal.created_at).getTime(),
        y: deal.amount || 0,
        z: 1, // Uniform size for now, or could be related to profit
        name: deal.title,
        company: deal.companies?.name
      })) || [];
      setScatterData(scatterPoints);

      // --- PLUSHER FEATURES END ---

      // 3. Top 5 Deals
      setTopDeals(wonDeals?.slice(0, 5) || []);

      // 3.1 Top Customers (LTV)
      const customerMap = new Map<string, { value: number, count: number }>();
      wonDeals?.forEach(deal => {
        const name = deal.companies?.name;
        if (name) {
             const current = customerMap.get(name) || { value: 0, count: 0 };
             customerMap.set(name, { 
               value: current.value + (deal.amount || 0), 
               count: current.count + 1 
             });
        }
      });
      
      const topCustomersList = Array.from(customerMap.entries())
        .map(([name, data]) => ({ 
          name, 
          value: data.value,
          count: data.count,
          avg: data.count > 0 ? data.value / data.count : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      setTopCustomers(topCustomersList);

      // 4. Conversion Rate
      const { count: totalClosed } = await crm
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .in('status', ['won', 'lost']);
      
      const wonCount = wonDeals?.length || 0;
      const rate = totalClosed ? Math.round((wonCount / totalClosed) * 100) : 0;
      setConversionRate(rate);

      // 5. Average Deal Size
      const avgSize = wonCount > 0 ? total / wonCount : 0;
      setAvgDealSize(avgSize);

      // 6. Monthly Performance (Last 6 months)
      const monthsData = [];
      const financeStats = []; // For Finance Tab

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        // Filter Deals (Contracted)
        const monthDeals = wonDeals?.filter(d => {
          const dealDate = new Date(d.created_at);
          return dealDate >= monthStart && dealDate <= monthEnd;
        }) || [];
        
        // Filter Payments (Collected)
        const monthPayments = allPayments.filter((p: any) => {
            const payDate = new Date(p.date);
            return payDate >= monthStart && payDate <= monthEnd;
        });
        
        const monthRevenue = monthDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
        const monthCollected = monthPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        
        const monthName = date.toLocaleDateString('ru-RU', { month: 'short' });

        monthsData.push({
          month: monthName,
          revenue: monthRevenue,
          deals: monthDeals.length
        });

        financeStats.push({
            month: monthName,
            contracted: monthRevenue,
            collected: monthCollected,
            gap: monthRevenue - monthCollected
        });
      }
      setMonthlyData(monthsData);
      setFinanceData(financeStats);

      // 7. Performance vs Plan
      // Note: performanceData will be computed in render using current monthlyPlan state
      // to avoid stale data issues when plan loads asynchronously

      // 8. Deals by Stage
      const { data: dealsByStage } = await crm
        .from('deals')
        .select('stage_id, stages(name), amount')
        .eq('status', 'open');
        
      const stageGroups = dealsByStage?.reduce((acc: any, curr) => {
        const name = curr.stages?.name || 'Неизвестно';
        const existing = acc.find((i: any) => i.name === name);
        if (existing) {
          existing.value += curr.amount || 0;
          existing.count += 1;
        } else {
          acc.push({ 
            name, 
            value: curr.amount || 0, 
            count: 1 
          });
        }
        return acc;
      }, []) || [];

      setStageData(stageGroups);

    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('uz-UZ', { 
      style: 'currency', 
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatChartAxisValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toString();
  };

  const exportSalesReport = async () => {
    try {
      const { data: wonDeals } = await crm
        .from('deals')
        .select('title, amount, created_at, companies(name), status')
        .eq('status', 'won')
        .order('created_at', { ascending: false });

      if (!wonDeals || wonDeals.length === 0) {
        toast.error('Нет данных для экспорта');
        return;
      }

      const exportData = wonDeals.map(deal => ({
        'Название': deal.title,
        'Клиент': deal.companies?.name || 'Без клиента',
        'Сумма (UZS)': formatCurrencyForExport(deal.amount),
        'Дата закрытия': formatDateForExport(deal.created_at),
        'Статус': deal.status === 'won' ? 'Выиграно' : 'Проиграно'
      }));

      downloadCSV(exportData, `sales-report-${new Date().toISOString().split('T')[0]}`);
      toast.success('Отчет успешно экспортирован');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Ошибка экспорта данных');
    }
  };

  const exportPipelineReport = async () => {
    try {
      const { data: deals } = await crm
        .from('deals')
        .select('title, amount, created_at, companies(name), stages(name), status')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (!deals || deals.length === 0) {
        toast.error('Нет данных для экспорта');
        return;
      }

      const exportData = deals.map(deal => ({
        'Название': deal.title,
        'Клиент': deal.companies?.name || 'Без клиента',
        'Этап': deal.stages?.name || 'Неизвестно',
        'Сумма (UZS)': formatCurrencyForExport(deal.amount),
        'Дата создания': formatDateForExport(deal.created_at)
      }));

      downloadCSV(exportData, `pipeline-report-${new Date().toISOString().split('T')[0]}`);
      toast.success('Отчет по воронке экспортирован');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Ошибка экспорта данных');
    }
  };

  const planProgress = monthlyPlan > 0 ? Math.round((monthlyRevenue / monthlyPlan) * 100) : 0;
  const isPlanExceeded = planProgress > 100;
  
  // Calculate performanceData using current state values to avoid stale data
  const performanceData = monthlyPlan > 0 ? [
    { name: 'Выполнено', value: monthlyRevenue },
    { name: 'Осталось', value: Math.max(0, monthlyPlan - monthlyRevenue) }
  ] : [];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Загрузка отчетов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Отчеты и Аналитика</h2>
            <p className="text-muted-foreground">Детальный анализ продаж и выполнения плана</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Target className="mr-2 h-4 w-4" />
                Установить план
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>План продаж на месяц</DialogTitle>
                <DialogDescription>
                  Установите целевую сумму продаж для текущего месяца
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plan">Целевая сумма (UZS)</Label>
                  <Input
                    id="plan"
                    type="number"
                    placeholder="50000000"
                    value={planInput}
                    onChange={(e) => setPlanInput(e.target.value)}
                  />
                </div>
                <Button onClick={savePlan} className="w-full">
                  Сохранить план
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

        {/* Date Range Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="customRange"
                  checked={isCustomDateRange}
                  onChange={(e) => {
                    setIsCustomDateRange(e.target.checked);
                    if (!e.target.checked) {
                      setDateFrom('');
                      setDateTo('');
                      loadReports();
                    }
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="customRange" className="cursor-pointer">
                  Произвольный период
                </Label>
              </div>
              
              {isCustomDateRange && (
                <>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="dateFrom">Дата от</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="dateTo">Дата до</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={loadReports}
                    disabled={!dateFrom || !dateTo}
                  >
                    Применить
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Обзор
          </TabsTrigger>
          <TabsTrigger value="sales">
            <TrendingUp className="mr-2 h-4 w-4" />
            Продажи
          </TabsTrigger>
          <TabsTrigger value="finance">
            <DollarSign className="mr-2 h-4 w-4" />
            Финансы
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <PieChart className="mr-2 h-4 w-4" />
            Воронка
          </TabsTrigger>

        </TabsList>



        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow relative" 
              onClick={() => setMetricInfoOpen('plan')}
            >
              <div className="absolute top-2 right-2">
                <HelpCircle className="h-4 w-4 text-blue-500" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">План на месяц</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(monthlyPlan)}</div>
                <div className="flex items-center justify-between mt-1">
                   <p className="text-xs text-muted-foreground">Выполнено: {planProgress}%</p>
                   {monthlyPlan > 0 && (
                     <p className="text-xs font-medium text-slate-500">Прогноз: {formatCurrency(projectedRevenue)}</p>
                   )}
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${isPlanExceeded ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(planProgress, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow relative" 
              onClick={() => setMetricInfoOpen('revenue')}
            >
              <div className="absolute top-2 right-2">
                <HelpCircle className="h-4 w-4 text-blue-500" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Сумма продаж за месяц</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(monthlyRevenue)}</div>
                <div className="flex items-center gap-2 mt-1">
                   {revenueGrowth !== 0 && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${revenueGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                      </span>
                   )}
                   <p className="text-xs text-muted-foreground">к прошлому месяцу</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow relative" 
              onClick={() => setMetricInfoOpen('forecast')}
            >
              <div className="absolute top-2 right-2">
                <HelpCircle className="h-4 w-4 text-blue-500" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Smart Forecast (AI)</CardTitle>
                <Sparkles className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(projectedRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Предиктивная модель на основе истории
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow relative" 
              onClick={() => setMetricInfoOpen('conversion')}
            >
              <div className="absolute top-2 right-2">
                <HelpCircle className="h-4 w-4 text-blue-500" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversionRate}%</div>
                 <div className="flex items-center gap-2 mt-1">
                   {dealsGrowth !== 0 && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${dealsGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {dealsGrowth >= 0 ? '+' : ''}{dealsGrowth.toFixed(1)}%
                      </span>
                   )}
                   <p className="text-xs text-muted-foreground">рост сделок</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Динамика за 6 месяцев</CardTitle>
                <CardDescription>Сумма продаж по месяцам</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full min-w-0" style={{ height: 300, width: '100%' }}>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={formatChartAxisValue} />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Сумма продаж']}
                          labelStyle={{ color: '#64748b' }}
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6' }}
                          name="Сумма продаж"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>План vs Факт</CardTitle>
                <CardDescription>Выполнение плана текущего месяца</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full min-w-0" style={{ height: 300, width: '100%' }}>
                  {monthlyPlan > 0 ? (
                    mounted && (
                      <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
                        <RechartsPieChart>
                          <Pie
                            data={performanceData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {performanceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#e5e7eb'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Установите план продаж
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SALES TAB */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={exportSalesReport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Экспорт продаж в CSV
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Топ-5 сделок</CardTitle>
                <CardDescription>Самые крупные чеки</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topDeals.length > 0 ? (
                    topDeals.map((deal, index) => (
                      <div key={deal.id || index} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                              {index + 1}
                            </span>
                            <p className="font-medium text-sm truncate max-w-[120px]" title={deal.title}>{deal.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-8 truncate max-w-[120px]">
                            {deal.companies?.name || 'Без клиента'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-green-600">
                            {formatCurrency(deal.amount)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Нет закрытых сделок
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Топ клиентов (LTV)</CardTitle>
                <CardDescription>Лидеры по сумме покупок</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCustomers.length > 0 ? (
                    topCustomers.map((customer, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                         <div className="flex items-center gap-3 overflow-hidden flex-1">
                             <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                 {index + 1}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <p className="font-medium text-sm truncate" title={customer.name}>{customer.name}</p>
                                 <p className="text-xs text-muted-foreground truncate">
                                    {customer.count} {customer.count === 1 ? 'сделка' : 'сделок'} • Ср. чек: {formatCurrency(customer.avg)}
                                 </p>
                             </div>
                         </div>
                         <div className="text-right pl-2">
                             <p className="font-bold text-sm text-slate-900 whitespace-nowrap">{formatCurrency(customer.value)}</p>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                       Нет данных
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Статистика продаж</CardTitle>
                <CardDescription>Ключевые показатели</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Всего продаж</p>
                      <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>

                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">За текущий месяц</p>
                      <p className="text-xl font-bold">{formatCurrency(monthlyRevenue)}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>

                  <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Средний чек</p>
                      <p className="text-xl font-bold">{formatCurrency(avgDealSize)}</p>
                    </div>
                    <Award className="h-8 w-8 text-purple-600" />
                  </div>

                  <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-xl font-bold">{conversionRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Продажи по дням недели</CardTitle>
                <CardDescription>В какие дни мы закрываем больше сделок</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full min-w-0" style={{ height: 300, width: '100%' }}>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
                      <BarChart data={dayOfWeekData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={formatChartAxisValue} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Сумма продаж" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Распределение сделок</CardTitle>
                <CardDescription>Зависимость суммы от времени</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full min-w-0" style={{ height: 300, width: '100%' }}>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis 
                          type="number" 
                          dataKey="x" 
                          name="Дата" 
                          domain={['auto', 'auto']}
                          tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString('ru-RU')}
                        />
                        <YAxis type="number" dataKey="y" name="Сумма" unit=" UZS" tickFormatter={formatChartAxisValue} />
                        <ZAxis type="number" dataKey="z" range={[60, 400]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-2 border rounded shadow-sm text-xs">
                                <p className="font-bold">{data.name}</p>
                                <p>{data.company}</p>
                                <p className="text-blue-600">{formatCurrency(data.y)}</p>
                                <p className="text-gray-500">{new Date(data.x).toLocaleDateString()}</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Scatter name="Сделки" data={scatterData} fill="#ec4899" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Динамика продаж</CardTitle>
              <CardDescription>Выручка и количество сделок за последние 6 месяцев</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full min-w-0" style={{ height: 350, width: '100%' }}>
                {mounted && (
                  <ResponsiveContainer width="100%" height={350} minWidth={0} debounce={50}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" tickFormatter={formatChartAxisValue} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Выручка') return [formatCurrency(value), 'Выручка'];
                          return [value, 'Сделок'];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Выручка" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="deals" fill="#10b981" name="Сделок" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCE TAB */}
        <TabsContent value="finance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Подписано контрактов</CardTitle>
                        <FileText className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(financeData.reduce((sum, item) => sum + item.contracted, 0))}</div>
                        <p className="text-xs text-muted-foreground mt-1">За последние 6 месяцев</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Фактически получено</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(financeData.reduce((sum, item) => sum + item.collected, 0))}</div>
                        <p className="text-xs text-muted-foreground mt-1">Реальные поступления на счет</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {financeData.reduce((sum, item) => sum + item.contracted, 0) - financeData.reduce((sum, item) => sum + item.collected, 0) > 0 
                                ? "Кассовый разрыв" 
                                : "Профицит поступлений"}
                        </CardTitle>
                        {financeData.reduce((sum, item) => sum + item.contracted, 0) - financeData.reduce((sum, item) => sum + item.collected, 0) > 0 
                            ? <AlertCircle className="h-4 w-4 text-orange-500" />
                            : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        }
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const gap = financeData.reduce((sum, item) => sum + item.contracted, 0) - financeData.reduce((sum, item) => sum + item.collected, 0);
                            const isPositiveGap = gap > 0;
                            
                            return (
                                <>
                                    <div className={`text-2xl font-bold ${isPositiveGap ? 'text-orange-600' : 'text-emerald-600'}`}>
                                        {formatCurrency(Math.abs(gap))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isPositiveGap 
                                            ? "Дебиторская задолженность (клиенты должны)" 
                                            : "Погашение старых долгов (сверх плана)"}
                                    </p>
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cash Flow Анализ</CardTitle>
                    <CardDescription>Сравнение начисленной выручки и реальных поступлений</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full min-w-0">
                        {mounted && (
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={financeData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis tickFormatter={formatChartAxisValue} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="contracted" name="Подписано" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="collected" name="Получено" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={exportPipelineReport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Экспорт воронки в CSV
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Распределение по этапам</CardTitle>
                <CardDescription>Открытые сделки в воронке</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full min-w-0" style={{ height: 350, width: '100%' }}>
                  {stageData.length > 0 ? (
                    mounted && (
                      <ResponsiveContainer width="100%" height={350} minWidth={0} debounce={50}>
                        <RechartsPieChart>
                          <Pie
                            data={stageData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {stageData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Нет открытых сделок
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Детали по этапам</CardTitle>
                <CardDescription>Количество и сумма сделок</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stageData.length > 0 ? (
                    stageData.map((stage, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium">{stage.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {stage.count} {stage.count === 1 ? 'сделка' : 'сделок'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(stage.value)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Нет данных
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

            <Card>
              <CardHeader>
                <CardTitle>Воронка продаж</CardTitle>
                <CardDescription>Объем открытых сделок на каждом этапе</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full min-w-0">
                  {stageData.length > 0 ? (
                    mounted && (
                      <ResponsiveContainer width="100%" height={400} minWidth={0} debounce={50}>
                        <BarChart 
                          data={[...stageData].sort((a, b) => b.value - a.value)} 
                          layout="vertical"
                          margin={{ left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={formatChartAxisValue} />
                          <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12}} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {stageData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Нет данных для отображения
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Metric Info Dialogs */}
      <Dialog open={metricInfoOpen === 'plan'} onOpenChange={() => setMetricInfoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              План на месяц
            </DialogTitle>
            <DialogDescription>Целевая выручка и отслеживание прогресса</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">💡 Что это?</h4>
              <p className="text-sm text-muted-foreground">
                Месячная цель по выручке, которую вы устанавливаете для отдела продаж.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">🎯 Зачем нужно?</h4>
              <p className="text-sm text-muted-foreground">
                • Мотивировать команду на достижение конкретных результатов<br />
                • Отслеживать прогресс в режиме реального времени<br />
                • Прогнозировать выполнение плана к концу месяца
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">📊 Как использовать?</h4>
              <p className="text-sm text-muted-foreground">
                Устанавливайте реалистичный план исходя из истории продаж. Прогресс-бар показывает текущее выполнение. Зелёный цвет означает перевыполнение плана.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metricInfoOpen === 'revenue'} onOpenChange={() => setMetricInfoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Выручка за месяц
            </DialogTitle>
            <DialogDescription>Фактическая выручка текущего месяца</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">💡 Что это?</h4>
              <p className="text-sm text-muted-foreground">
                Сумма всех закрытых (выигранных) сделок с начала текущего месяца до сегодняшнего дня.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">🎯 Зачем нужно?</h4>
              <p className="text-sm text-muted-foreground">
                • Оценить текущую эффективность продаж<br />
                • Сравнить с прошлым месяцем (процент роста)<br />
                • Понять, достигнете ли вы месячного плана
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">📈 Рост к прошлому месяцу</h4>
              <p className="text-sm text-muted-foreground">
                Зелёный бейдж показывает прирост, красный — снижение по сравнению с выручкой за аналогичный период прошлого месяца.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metricInfoOpen === 'forecast'} onOpenChange={() => setMetricInfoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Smart Forecast (AI)
            </DialogTitle>
            <DialogDescription>Профессиональная модель прогнозирования</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">💡 Что это?</h4>
              <p className="text-sm text-muted-foreground">
                Интеллектуальный прогноз выручки на конец месяца, учитывающий историческую конверсию, текущую воронку и динамику продаж.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">🔮 Формула расчета</h4>
              <p className="text-sm text-muted-foreground bg-purple-50 p-3 rounded-lg">
                <strong>Weighted Forecast =</strong><br />
                Текущая выручка + (Открытая воронка × Win Rate)<br /><br />
                <em>Где Win Rate рассчитывается на основе ваших продаж за последние 6 месяцев.</em>
              </p>
              <p className="text-xs text-muted-foreground">
                Модель также адаптируется к дню месяца: в начале месяца больше веса придается линейному тренду (Run Rate), а к концу — реальной воронке сделок.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metricInfoOpen === 'conversion'} onOpenChange={() => setMetricInfoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              Конверсия (Win Rate)
            </DialogTitle>
            <DialogDescription>Процент успешно закрытых сделок</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">💡 Что это?</h4>
              <p className="text-sm text-muted-foreground">
                Процент сделок, которые были успешно закрыты (выиграны), от общего числа завершённых сделок (выигранные + проигранные).
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">📊 Как рассчитывается?</h4>
              <p className="text-sm text-muted-foreground bg-orange-50 p-3 rounded-lg">
                <strong>Формула:</strong><br />
                Конверсия = (Выигранные сделки ÷ Все закрытые сделки) × 100%
              </p>
              <p className="text-xs text-muted-foreground">
                Например: из 100 завершённых сделок выиграли 65 — конверсия 65%.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">🎯 Зачем нужно?</h4>
              <p className="text-sm text-muted-foreground">
                • Оценить эффективность менеджеров<br />
                • Понять качество лидов<br />
                • Выявить проблемы в воронке продаж<br />
                • Сравнить результаты с прошлыми периодами
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">✅ Хорошие показатели</h4>
              <p className="text-sm text-muted-foreground">
                Конверсия выше 50% считается отличным результатом. Ниже 30% — сигнал для анализа проблем.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}