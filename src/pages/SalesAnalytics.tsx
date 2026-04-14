import { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { DateRangePicker } from '../components/analytics/DateRangePicker';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  Percent,
  BarChart3,
  PieChart,
  Brain,
  AlertTriangle,
  Trophy,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Info,
  Clock,
  Zap,
  Layers
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { crm } from "@/lib/crmClient.ts";
import { toast } from 'sonner@2.0.3';

export default function SalesAnalytics() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Date filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Plan State
  const [monthlyPlan, setMonthlyPlan] = useState<number>(0);
  const [planInput, setPlanInput] = useState<string>('');
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  
  // Data states
  const [abcData, setAbcData] = useState<any>(null);
  const [rfmData, setRfmData] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [advancedForecastData, setAdvancedForecastData] = useState<any>(null);
  const [managerData, setManagerData] = useState<any>(null);
  const [lostDealsData, setLostDealsData] = useState<any>(null);
  const [cohortData, setCohortData] = useState<any>(null);
  const [velocityData, setVelocityData] = useState<any>(null);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any[]>([]);

  useEffect(() => {
    fetchAllAnalytics();
    loadPlan();
  }, [startDate, endDate]);

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

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const baseUrl = `${crmUrl('/analytics')}`;
      const headers = { ...authHeaders(false) };
      
      // Build query params for date filtering
      const dateParams = new URLSearchParams();
      if (startDate) dateParams.append('startDate', startDate);
      if (endDate) dateParams.append('endDate', endDate);
      const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : '';

      const [abc, rfm, funnel, forecast, advancedForecast, manager, lost, cohort, velocity, heatmap] = await Promise.all([
        fetch(`${baseUrl}/abc-analysis${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/rfm-segmentation${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/funnel-conversion${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/sales-forecast`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/advanced-forecast`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/manager-performance${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/lost-deals${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/cohort-analysis`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/sales-velocity${dateQuery}`, { headers }).then(r => r.json()),
        fetch(`${baseUrl}/activity-heatmap`, { headers }).then(r => r.json())
      ]);

      setAbcData(abc);
      setRfmData(rfm);
      setFunnelData(funnel);
      setForecastData(forecast);
      setAdvancedForecastData(advancedForecast);
      setManagerData(manager);
      setLostDealsData(lost);
      setCohortData(cohort);
      setVelocityData(velocity);
      setHeatmapData(heatmap);

      // --- Finance Data (Deals vs Payments) ---
      const now = new Date();
      // Start of 6 months ago
      const startOfPeriod = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
      
      const { data: wonDeals } = await crm
        .from('deals')
        .select('amount, created_at, status')
        .eq('status', 'won')
        .gte('created_at', startOfPeriod);
        
      const paymentsResponse = await fetch(`${crmUrl('/payments')}`, {
        headers: { ...authHeaders(false) }
      });
      const allPayments = paymentsResponse.ok ? await paymentsResponse.json() : [];
      
      const financeStats = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthDeals = wonDeals?.filter((d: any) => {
          const dealDate = new Date(d.created_at);
          return dealDate >= monthStart && dealDate <= monthEnd;
        }) || [];
        
        const monthPayments = allPayments.filter((p: any) => {
            const payDate = new Date(p.date);
            return payDate >= monthStart && payDate <= monthEnd;
        });
        
        const monthRevenue = monthDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
        const monthCollected = monthPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        
        financeStats.push({
            month: date.toLocaleDateString('ru-RU', { month: 'short' }),
            contracted: monthRevenue,
            collected: monthCollected,
            gap: monthRevenue - monthCollected
        });
      }
      setFinanceData(financeStats);
      
      toast.success('Данные обновлены');
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleResetDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleExport = async () => {
    try {
      const baseUrl = `${crmUrl('/analytics')}`;
      const headers = { ...authHeaders(false) };
      
      const response = await fetch(`${baseUrl}/export?type=all`, { headers });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Данные экспортированы');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Ошибка экспорта');
    }
  };

  const formatCurrency = (value: number) => {
    return Math.round(value).toLocaleString('uz-UZ');
  };

  const COLORS = {
    A: '#10b981', // green
    B: '#f59e0b', // orange
    C: '#ef4444', // red
    champions: '#8b5cf6',
    loyal: '#3b82f6',
    newCustomers: '#10b981',
    atRisk: '#f59e0b',
    lost: '#ef4444',
    bigSpenders: '#ec4899'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Аналитика и Отчеты
          </h1>
          <p className="text-slate-600 mt-1">Глубокий анализ клиентов, воронки и прогноз</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showFilters ? "default" : "outline"} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            {showFilters ? 'Скрыть фильтры' : 'Фильтры'}
          </Button>
          
          <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Target className="mr-2 h-4 w-4" />
                План
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

          <Button variant="outline" onClick={fetchAllAnalytics}>
            <Filter className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      {showFilters && (
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onReset={handleResetDates}
        />
      )}

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Выполнение плана</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold text-slate-900">
              {monthlyPlan > 0 ? Math.round((abcData?.totalRevenue / monthlyPlan) * 100) : 0}%
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div 
                   className="h-full bg-slate-900 rounded-full" 
                   style={{ width: `${Math.min(monthlyPlan > 0 ? (abcData?.totalRevenue / monthlyPlan) * 100 : 0, 100)}%` }}
                ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
               Цель: {formatCurrency(monthlyPlan)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Общая выручка (выигранные)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(abcData?.totalRevenue || 0)} <span className="text-sm text-slate-500">сум</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Всего клиентов: {abcData?.totalCompanies || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Конверсия воронки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {funnelData?.winRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {funnelData?.wonDeals || 0} выиграно / {funnelData?.lostDeals || 0} потеряно
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Прогноз на след. месяц</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {advancedForecastData?.forecast?.[0] ? formatCurrency(advancedForecastData.forecast[0].predictedRevenue) : '—'} 
              <span className="text-sm text-slate-500"> сум</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {(advancedForecastData?.trend?.direction === 'рост') ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <p className="text-xs text-slate-500">
                {Math.abs(advancedForecastData?.trend?.percent || 0).toFixed(1)}% {advancedForecastData?.trend?.direction || 'тренд'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Потери за период</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(lostDealsData?.totalLostValue || 0)} <span className="text-sm text-slate-500">сум</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Сделок потеряно: {lostDealsData?.totalLost || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different analyses */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="overview" className="whitespace-nowrap">Обзор</TabsTrigger>
            <TabsTrigger value="finance" className="whitespace-nowrap">Финансы</TabsTrigger>
            <TabsTrigger value="abc" className="whitespace-nowrap">ABC-анализ</TabsTrigger>
            <TabsTrigger value="rfm" className="whitespace-nowrap">RFM-сегменты</TabsTrigger>
            <TabsTrigger value="funnel" className="whitespace-nowrap">Воронка</TabsTrigger>
            <TabsTrigger value="forecast" className="whitespace-nowrap">Прогноз AI</TabsTrigger>
            <TabsTrigger value="cohorts" className="whitespace-nowrap">Когорты</TabsTrigger>
            <TabsTrigger value="velocity" className="whitespace-nowrap">Скорость</TabsTrigger>
            <TabsTrigger value="heatmap" className="whitespace-nowrap">Активность</TabsTrigger>
            <TabsTrigger value="managers" className="whitespace-nowrap">Менеджеры</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-yellow-900">Sales Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-yellow-900">
                  {formatCurrency(velocityData?.velocity || 0)} <span className="text-xs">сум/день</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-indigo-900">Avg Retention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-indigo-900">
                  {(cohortData?.avgRetentionRate || 0).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-orange-900">Avg Sales Cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-orange-900">
                  {velocityData?.avgSalesCycle || 0} <span className="text-xs">дней</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-green-900">Total Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-green-900">
                  {cohortData?.totalCustomers || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ABC Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Распределение клиентов по ABC</CardTitle>
                <CardDescription>Кто приносит основную выручку</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: 'A (80% выручки)', value: abcData?.analysis?.filter((c: any) => c.category === 'A').length || 0, fill: COLORS.A },
                        { name: 'B (15% выручки)', value: abcData?.analysis?.filter((c: any) => c.category === 'B').length || 0, fill: COLORS.B },
                        { name: 'C (5% выручки)', value: abcData?.analysis?.filter((c: any) => c.category === 'C').length || 0, fill: COLORS.C }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      <Cell fill={COLORS.A} />
                      <Cell fill={COLORS.B} />
                      <Cell fill={COLORS.C} />
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RFM Segments */}
            <Card>
              <CardHeader>
                <CardTitle>RFM Сегментация клиентов</CardTitle>
                <CardDescription>По активности и ценности</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={Object.entries(
                      (rfmData?.analysis || []).reduce((acc: any, item: any) => {
                        acc[item.segment] = (acc[item.segment] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([segment, count]) => ({ segment, count }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="segment" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          {advancedForecastData?.aiInsights && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI-анализ трендов (GPT-4o-mini)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-line">{advancedForecastData.aiInsights}</p>
              </CardContent>
            </Card>
          )}

          {/* Top Lost Reasons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Почему теряем сделки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lostDealsData?.reasonAnalysis?.slice(0, 5).map((reason: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{reason.reason}</p>
                      <p className="text-sm text-slate-600">{reason.count} сделок</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{formatCurrency(reason.totalValue)} сум</p>
                      <p className="text-xs text-slate-500">{reason.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Финансовый разрыв (Cash Gap)</CardTitle>
              <CardDescription>
                Разница между подписанными контрактами и реальными поступлениями
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: '#64748b' }}
                  />
                  <Legend />
                  <Bar dataKey="contracted" name="Контракты" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Поступления" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              
              <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-sm text-slate-900">Детализация по месяцам</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-3 text-left">Месяц</th>
                                <th className="p-3 text-right">Контракты</th>
                                <th className="p-3 text-right">Поступления</th>
                                <th className="p-3 text-right">Разрыв (Gap)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {financeData.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-slate-50">
                                    <td className="p-3 font-medium">{item.month}</td>
                                    <td className="p-3 text-right font-medium text-blue-600">{formatCurrency(item.contracted)}</td>
                                    <td className="p-3 text-right font-medium text-green-600">{formatCurrency(item.collected)}</td>
                                    <td className="p-3 text-right">
                                        <span className={`font-bold ${item.gap > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {formatCurrency(item.gap)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABC Analysis Tab */}
        <TabsContent value="abc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ABC-анализ клиентов</CardTitle>
              <CardDescription>
                Категория A - приносят 80% выручки, B - 15%, C - 5%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Клиент</th>
                      <th className="p-3 text-right">Выручка</th>
                      <th className="p-3 text-center">% от общей</th>
                      <th className="p-3 text-center">Кумулятивный %</th>
                      <th className="p-3 text-center">Сделок</th>
                      <th className="p-3 text-center">Категория</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abcData?.analysis?.map((company: any, idx: number) => (
                      <tr key={company.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{company.rank}</td>
                        <td className="p-3 font-medium">{company.name}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(company.revenue)}</td>
                        <td className="p-3 text-center">{company.percentage.toFixed(1)}%</td>
                        <td className="p-3 text-center">{company.cumulativePercentage.toFixed(1)}%</td>
                        <td className="p-3 text-center">{company.dealCount}</td>
                        <td className="p-3 text-center">
                          <Badge 
                            style={{ 
                              backgroundColor: COLORS[company.category as keyof typeof COLORS],
                              color: 'white'
                            }}
                          >
                            {company.category}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RFM Segmentation Tab */}
        <TabsContent value="rfm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>RFM-сегментация</CardTitle>
              <CardDescription>
                Recency (давность), Frequency (частота), Monetary (деньги) - оценка 1-4
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Клиент</th>
                      <th className="p-3 text-center">RFM Score</th>
                      <th className="p-3 text-right">Последняя покупка</th>
                      <th className="p-3 text-center">Частота</th>
                      <th className="p-3 text-right">Выручка</th>
                      <th className="p-3 text-center">Сегмент</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfmData?.analysis?.map((company: any) => (
                      <tr key={company.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium">{company.name}</td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-blue-600">{company.rfmScore}</span>
                          <div className="text-xs text-slate-500">
                            R:{company.R} F:{company.F} M:{company.M}
                          </div>
                        </td>
                        <td className="p-3 text-right">{company.recencyDays} дней назад</td>
                        <td className="p-3 text-center">{company.frequency} раз</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(company.monetary)}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {company.segment}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Segment Recommendations */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Рекомендации по сегментам</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-blue-900">
              <div>
                <p className="font-semibold">🏆 Champions (444):</p>
                <p>Лучшие клиенты! Поддерживайте связь, предлагайте VIP-программы.</p>
              </div>
              <div>
                <p className="font-semibold">💎 Big Spenders (высокий M):</p>
                <p>Тратят много - увеличьте частоту покупок через upsell.</p>
              </div>
              <div>
                <p className="font-semibold">🆕 New Customers (высокий R, низкий F):</p>
                <p>Новички - работайте над удержанием и повторными покупками.</p>
              </div>
              <div>
                <p className="font-semibold">⚠️ At Risk (низкий R, высокий F):</p>
                <p>Давно не покупают - срочно реактивируйте (звонок, спецпредложение).</p>
              </div>
              <div>
                <p className="font-semibold">❌ Lost (низкий R, низкий F):</p>
                <p>Потеряны - либо win-back кампания, либо не тратьте ресурсы.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funnel Conversion Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Воронка продаж и конверсия</CardTitle>
              <CardDescription>Где теряем клиентов</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={funnelData?.funnel || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={120} />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'count') return `${value} сделок`;
                      if (name === 'totalValue') return `${formatCurrency(value)} сум`;
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Количество сделок" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {funnelData?.funnel?.map((stage: any, idx: number) => (
                  <Card key={idx}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm capitalize">{stage.stage}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold">{stage.count} сделок</p>
                        <p className="text-sm text-slate-600">
                          Средний чек: {formatCurrency(stage.avgDealSize)} сум
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            {stage.conversionRate.toFixed(1)}% конверсия
                          </Badge>
                          {stage.dropoffRate > 0 && (
                            <Badge variant="destructive">
                              -{stage.dropoffRate.toFixed(1)}% отток
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          {/* Trend Info Card */}
          {advancedForecastData?.trend && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Текущий тренд</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {advancedForecastData.trend.direction === 'рост' ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-2xl font-bold">
                      {Math.abs(advancedForecastData.trend.percent).toFixed(1)}%
                    </span>
                    <span className={advancedForecastData.trend.direction === 'рост' ? 'text-green-600' : 'text-red-600'}>
                      {advancedForecastData.trend.direction}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Средняя выручка (3 мес)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(advancedForecastData.trend.recentAvg)} <span className="text-sm text-slate-500">сум</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Прогноз на след. месяц</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">
                    {advancedForecastData?.forecast?.[0] ? formatCurrency(advancedForecastData.forecast[0].predictedRevenue) : '—'} 
                    <span className="text-sm text-slate-500"> сум</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Уверенность: {advancedForecastData?.forecast?.[0] ? (advancedForecastData.forecast[0].confidence * 100).toFixed(0) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Insights */}
          {advancedForecastData?.aiInsights && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI-анализ тренда (GPT-4o-mini)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-line">{advancedForecastData.aiInsights}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Продвинутый прогноз (3 метода)
              </CardTitle>
              <CardDescription>Линейная регрессия, экспоненциальное сглаживание, скользящее среднее</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={[
                    ...(advancedForecastData?.historical || []).map((d: any) => ({ ...d, type: 'fact' })),
                    ...(advancedForecastData?.forecast || []).map((d: any) => ({ 
                      month: d.month, 
                      revenue: d.predictedRevenue,
                      linearRegression: d.linearRegression,
                      exponentialSmoothing: d.exponentialSmoothing,
                      movingAverage: d.movingAverage,
                      type: 'forecast'
                    }))
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip 
                    formatter={(value: any) => `${formatCurrency(value)} сум`}
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Выручка (факт + прогноз)"
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="linearRegression" 
                    stroke="#10b981" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Линейная регрессия"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="exponentialSmoothing" 
                    stroke="#f59e0b" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Эксп. сглаживание"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {advancedForecastData?.forecast?.map((month: any, idx: number) => (
                  <Card key={idx} className="border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{month.month}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-blue-600">
                        {formatCurrency(month.predictedRevenue)} <span className="text-sm text-slate-500">сум</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Уверенность: {(month.confidence * 100).toFixed(0)}%
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Диапазон: {formatCurrency(month.confidenceInterval.lower)} - {formatCurrency(month.confidenceInterval.upper)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Method Details */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-sm text-slate-900 mb-2">Методы прогнозирования:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold">Линейная регрессия:</span>
                    <p>Использует тренд исторических данных для экстраполяции будущих значений</p>
                  </div>
                  <div>
                    <span className="font-semibold">Экспоненциальное сглаживание:</span>
                    <p>Придает больший вес недавним данным (α = 0.3)</p>
                  </div>
                  <div>
                    <span className="font-semibold">Скользящее среднее:</span>
                    <p>Среднее значение последних 3 месяцев</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cohort Analysis Tab */}
        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Когортный анализ клиентов
              </CardTitle>
              <CardDescription>
                Анализ удержания и LTV по месяцам первой покупки
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="border-indigo-200 bg-indigo-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-indigo-900">Всего когорт</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-indigo-900">{cohortData?.totalCohorts || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-indigo-200 bg-indigo-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-indigo-900">Всего клиентов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-indigo-900">{cohortData?.totalCustomers || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-indigo-200 bg-indigo-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-indigo-900">Средний Retention</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-indigo-900">
                      {(cohortData?.avgRetentionRate || 0).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Когорта (месяц)</th>
                      <th className="p-3 text-center">Клиентов</th>
                      <th className="p-3 text-center">Повторных</th>
                      <th className="p-3 text-center">Retention %</th>
                      <th className="p-3 text-right">Выручка</th>
                      <th className="p-3 text-center">Сделок</th>
                      <th className="p-3 text-right">Средний чек</th>
                      <th className="p-3 text-right">LTV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData?.cohorts?.map((cohort: any) => (
                      <tr key={cohort.cohortMonth} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium">{cohort.cohortMonth}</td>
                        <td className="p-3 text-center">{cohort.customerCount}</td>
                        <td className="p-3 text-center text-green-600">{cohort.repeatCustomers}</td>
                        <td className="p-3 text-center">
                          <Badge variant={cohort.retentionRate >= 50 ? 'default' : 'outline'}>
                            {cohort.retentionRate.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(cohort.revenue)}</td>
                        <td className="p-3 text-center">{cohort.dealCount}</td>
                        <td className="p-3 text-right">{formatCurrency(cohort.avgDealSize)}</td>
                        <td className="p-3 text-right font-bold text-indigo-600">{formatCurrency(cohort.ltv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-sm text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Что такое когортный анализ?
                </h4>
                <p className="text-sm text-blue-800">
                  Когорта - группа клиентов, совершивших первую покупку в одном месяце. 
                  <strong> Retention Rate</strong> показывает % клиентов, вернувшихся за повторной покупкой.
                  <strong> LTV (Lifetime Value)</strong> - средняя выручка на одного клиента когорты.
                  Высокий retention и LTV указывают на лояльность клиентов.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Velocity Tab */}
        <TabsContent value="velocity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Скорость продаж (Sales Velocity)
              </CardTitle>
              <CardDescription>
                Как быстро сделки движутся по воронке и закрываются
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-900">Средний цикл сделки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <p className="text-2xl font-bold text-yellow-900">
                        {velocityData?.avgSalesCycle || 0} <span className="text-sm">дней</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Цикл выигранных</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-900">
                      {velocityData?.avgWonCycle || 0} <span className="text-sm">дней</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-900">
                      {(velocityData?.winRate || 0).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Velocity Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-purple-600" />
                      <p className="text-2xl font-bold text-purple-900">
                        {formatCurrency(velocityData?.velocity || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cycle Distribution */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-sm">Распределение по длительности цикла</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={velocityData?.cycleDaysDistribution ? [
                        { range: '0-7 дней', count: velocityData.cycleDaysDistribution['0-7'] },
                        { range: '8-30 дней', count: velocityData.cycleDaysDistribution['8-30'] },
                        { range: '31-60 дней', count: velocityData.cycleDaysDistribution['31-60'] },
                        { range: '61+ дней', count: velocityData.cycleDaysDistribution['61+'] }
                      ] : []}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" name="Количество сделок" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-sm text-yellow-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Что такое Sales Velocity?
                </h4>
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Sales Velocity</strong> - комплексный показатель скорости генерации выручки:
                </p>
                <p className="text-sm text-yellow-800 font-mono bg-white p-2 rounded">
                  Velocity = (Количество сделок × Средний чек × Win Rate) / Длительность цикла
                </p>
                <p className="text-sm text-yellow-800 mt-2">
                  Чем выше velocity, тем быстрее команда генерирует выручку. Для увеличения: 
                  ↑ количество сделок, ↑ средний чек, ↑ win rate, ↓ длительность цикла.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Heatmap Tab */}
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                Тепловая карта активности
              </CardTitle>
              <CardDescription>
                Когда клиенты чаще всего совершают покупки
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapData?.bestTime && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-900">🔥 Лучшее время для контакта</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-orange-900">
                      {heatmapData.bestTime.day}, {heatmapData.bestTime.timeRange}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      {heatmapData.bestTime.count} сделок закрыто в это время
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left border bg-slate-50">День недели</th>
                      {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                        <th key={hour} className="p-2 text-center border bg-slate-50 min-w-[40px]">
                          {hour}:00
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData?.heatmap?.map((dayData: any) => (
                      <tr key={dayData.dayIndex}>
                        <td className="p-2 font-medium border bg-slate-50">{dayData.day}</td>
                        {dayData.hours.map((hourData: any) => {
                          const maxCount = Math.max(...heatmapData.heatmap.flatMap((d: any) => 
                            d.hours.map((h: any) => h.count)
                          ));
                          const intensity = maxCount > 0 ? hourData.count / maxCount : 0;
                          const bgColor = intensity === 0 
                            ? 'bg-slate-50' 
                            : `rgba(251, 146, 60, ${0.2 + intensity * 0.8})`; // orange gradient

                          return (
                            <td
                              key={hourData.hour}
                              className="p-2 text-center border cursor-pointer hover:ring-2 hover:ring-orange-400"
                              style={{ backgroundColor: bgColor }}
                              title={`${dayData.day} ${hourData.hour}:00 - ${hourData.count} сделок`}
                            >
                              {hourData.count > 0 ? hourData.count : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <span className="text-sm text-slate-600">Интенсивность:</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-4 bg-slate-50 border border-slate-200 rounded"></div>
                  <span className="text-xs text-slate-500">Нет</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-4 rounded" style={{ backgroundColor: 'rgba(251, 146, 60, 0.4)' }}></div>
                  <span className="text-xs text-slate-500">Средняя</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-4 rounded" style={{ backgroundColor: 'rgba(251, 146, 60, 1)' }}></div>
                  <span className="text-xs text-slate-500">Высокая</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Managers Performance Tab */}
        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Эффективность менеджеров
              </CardTitle>
              <CardDescription>Кто приносит больше всего выручки</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Менеджер</th>
                      <th className="p-3 text-center">Всего сделок</th>
                      <th className="p-3 text-center">Выиграно</th>
                      <th className="p-3 text-center">Потеряно</th>
                      <th className="p-3 text-right">Выручка</th>
                      <th className="p-3 text-right">Средний чек</th>
                      <th className="p-3 text-center">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerData?.performance?.map((manager: any, idx: number) => (
                      <tr key={manager.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {idx < 3 && <Trophy className={`h-4 w-4 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : 'text-amber-600'}`} />}
                            <span className="font-medium">{manager.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">{manager.totalDeals}</td>
                        <td className="p-3 text-center text-green-600 font-semibold">{manager.wonDeals}</td>
                        <td className="p-3 text-center text-red-600">{manager.lostDeals}</td>
                        <td className="p-3 text-right font-bold">{formatCurrency(manager.totalRevenue)}</td>
                        <td className="p-3 text-right">{formatCurrency(manager.avgDealSize)}</td>
                        <td className="p-3 text-center">
                          <Badge 
                            variant={manager.winRate >= 50 ? 'default' : 'destructive'}
                          >
                            {manager.winRate.toFixed(0)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}