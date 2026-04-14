import React, { useState, useMemo, useEffect, useRef } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart,
  Area,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  Megaphone, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Upload,
  Calendar as CalendarIcon,
  MousePointerClick,
  Eye,
  ShoppingBag,
  Settings,
  PieChart as PieChartIcon,
  Download,
  Trash2,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { MarketingCalendar } from '../components/marketing/MarketingCalendar';
import { SmartAnalysis } from '../components/marketing/SmartAnalysis';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "../components/ui/utils";

// --- Interfaces ---
interface CampaignData {
  id: string;
  date: string;
  channel: 'Instagram - Bententrade' | 'Instagram - Bententrade.kz' | 'Google Ads' | 'OLX';
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: number;
}

interface MarketingEvent {
  id: string;
  title: string;
  date: string;
  type: 'campaign' | 'holiday' | 'technical';
  channel?: string;
  description?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const METRIC_DEFINITIONS = {
  revenue: {
    title: "Продажи (Месяц)",
    description: "Общая сумма выручки от подтвержденных заказов за выбранный период.",
    why: "Показывает финальный финансовый результат всех маркетинговых активностей. Это главный показатель успеха."
  },
  roas: {
    title: "ROAS (Return on Ad Spend)",
    description: "Коэффициент возврата инвестиций в рекламу. Рассчитывается как (Продажи / Расход) * 100%.",
    why: "Показывает эффективность вложений. ROAS 100% означает выход в ноль. ROAS 500% означает, что каждый 1 сум расхода принес 5 сумов продаж."
  },
  leads: {
    title: "Лиды",
    description: "Количество уникальных заявок (контактов), полученных с рекламы.",
    why: "Характеризует интерес аудитории. Большое количество лидов при низких продажах может указывать на проблемы в отделе продаж."
  },
  cpl: {
    title: "CPL (Cost Per Lead)",
    description: "Средняя стоимость привлечения одного лида (заявки). Рассчитывается как Расход / Количество лидов.",
    why: "Позволяет контролировать затраты на этапе получения контактов. Рост CPL может сигнализировать о выгорании аудитории или росте конкуренции."
  },
  ctr: {
    title: "CTR (Click-Through Rate)",
    description: "Показатель кликабельности объявлений. Отношение кликов к показам в процентах.",
    why: "Отражает привлекательность рекламного креатива и точность таргетинга. Низкий CTR часто ведет к дорогому клику."
  },
  conversion: {
    title: "Конверсия (CR)",
    description: "Процент пользователей, совершивших целевое действие (лид) после клика.",
    why: "Показывает качество посадочной страницы и соответствие предложения ожиданиям пользователя."
  },
  cpc: {
    title: "CPC (Cost Per Click)",
    description: "Средняя стоимость одного клика по рекламе.",
    why: "Зависит от конкуренции на аукционе и качества объявления. Важно для планирования бюджета."
  },
  cpa: {
    title: "CPA (Cost Per Action)",
    description: "Итоговая стоимость привлечения одной продажи (оплаченного заказа).",
    why: "Ключевой показатель рентабельности. Если CPA выше маржи товара, реклама работает в убыток."
  }
};

export default function Marketing() {
  const [isMounted, setIsMounted] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [chartContainerRef, setChartContainerRef] = useState<HTMLDivElement | null>(null);
  const [pieChartWidth, setPieChartWidth] = useState(0);
  const [pieChartContainerRef, setPieChartContainerRef] = useState<HTMLDivElement | null>(null);
  
  // Data State
  const [data, setData] = useState<CampaignData[]>([]);
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [monthlyTarget, setMonthlyTarget] = useState<number | string>(50000000);
  
  // UI State
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [activeChartTab, setActiveChartTab] = useState("trend");
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'manual' | 'file'>('manual');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<keyof typeof METRIC_DEFINITIONS | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  
  // Manual Entry Form
  const [newReport, setNewReport] = useState<{
    date: string;
    channel: string;
    campaignName: string;
    spend: string | number;
    impressions: string | number;
    clicks: string | number;
    leads: string | number;
    purchases: string | number;
    revenue: string | number;
  }>({
    date: new Date().toISOString().slice(0, 10),
    channel: 'Instagram - Bententrade',
    campaignName: '',
    spend: '',
    impressions: '',
    clicks: '',
    leads: '',
    purchases: '',
    revenue: ''
  });

  // --- Initial Load ---
  useEffect(() => {
    setIsMounted(true);
    fetchBackendData();
  }, []);

  useEffect(() => {
    if (!chartContainerRef) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setChartWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(chartContainerRef);
    return () => observer.disconnect();
  }, [chartContainerRef]);

  useEffect(() => {
    if (!pieChartContainerRef) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPieChartWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(pieChartContainerRef);
    return () => observer.disconnect();
  }, [pieChartContainerRef]);

  const fetchBackendData = async () => {
    const headers = { ...authHeaders() };

    // Helper to safely fetch with default value
    const safeFetch = async (url: string, defaultVal: any) => {
        try {
            const res = await fetch(url, { headers });
            if (res.ok) return await res.json();
            console.warn(`Fetch failed for ${url}: ${res.status}`);
            return defaultVal;
        } catch (e) {
            console.warn(`Network error for ${url}`, e);
            return defaultVal;
        }
    };

    // Parallel fetch with individual error handling
    const [reportsData, targetData, eventsData] = await Promise.all([
      safeFetch(`${crmUrl('/marketing/reports')}`, []),
      safeFetch(`${crmUrl('/marketing/target')}`, { target: 50000000 }),
      safeFetch(`${crmUrl('/marketing/events')}`, [])
    ]);

    if (Array.isArray(reportsData)) setData(reportsData);
    if (targetData?.target) setMonthlyTarget(targetData.target);
    if (Array.isArray(eventsData)) setEvents(eventsData);
  };

  // --- Filtering & Calculations ---

  // Global Filter
  const channelData = useMemo(() => {
     if (filterChannel === 'all') return data;
     return data.filter(d => String(d.channel || '').trim() === filterChannel);
  }, [data, filterChannel]);

  const filteredEvents = useMemo(() => {
     if (filterChannel === 'all') return events;
     return events.filter(e => !e.channel || String(e.channel || '').trim() === filterChannel);
  }, [events, filterChannel]);

  const availableChannels = useMemo(() => {
     const defaultChannels = ['Instagram - Bententrade', 'Instagram - Bententrade.kz', 'Google Ads', 'OLX'];
     const fromData = Array.from(new Set(data.map(d => String(d.channel || '').trim()))).filter(Boolean);
     return Array.from(new Set([...defaultChannels, ...fromData])).sort();
  }, [data]);

  // Date Filter Logic (Dynamic Range)
  const filteredData = useMemo(() => {
    if (!dateRange?.from) return channelData;
    
    const from = new Date(dateRange.from); from.setHours(0,0,0,0);
    const to = dateRange.to ? new Date(dateRange.to) : new Date(from); 
    to.setHours(23,59,59,999);

    return channelData.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= from && dDate <= to;
    });
  }, [channelData, dateRange]);

  const currentMonthData = filteredData; 

  const prevMonthData = useMemo(() => {
    if (!dateRange?.from) return [];
      
    const currentFrom = new Date(dateRange.from); currentFrom.setHours(0,0,0,0);
    const currentTo = dateRange.to ? new Date(dateRange.to) : new Date(currentFrom); 
    currentTo.setHours(23,59,59,999);

    const durationMs = currentTo.getTime() - currentFrom.getTime();
    // Previous period of same duration ending just before current period
    const prevTo = new Date(currentFrom.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs);
      
    return channelData.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= prevFrom && dDate <= prevTo;
    });
  }, [channelData, dateRange]);

  const calculateTotals = (dataset: CampaignData[]) => {
    return dataset.reduce((acc, curr) => ({
      spend: acc.spend + (Number(curr.spend) || 0),
      revenue: acc.revenue + (Number(curr.revenue) || 0),
      leads: acc.leads + (Number(curr.leads) || 0),
      purchases: acc.purchases + (Number(curr.purchases) || 0),
      clicks: acc.clicks + (Number(curr.clicks) || 0),
      impressions: acc.impressions + (Number(curr.impressions) || 0),
    }), { spend: 0, revenue: 0, leads: 0, purchases: 0, clicks: 0, impressions: 0 });
  };

  const totals = calculateTotals(currentMonthData);
  const prevTotals = calculateTotals(prevMonthData);

  // MoM Growth
  const calculateGrowth = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const revenueGrowth = calculateGrowth(totals.revenue, prevTotals.revenue);
  const spendGrowth = calculateGrowth(totals.spend, prevTotals.spend);
  const leadsGrowth = calculateGrowth(totals.leads, prevTotals.leads);

  const roas = totals.spend > 0 ? (totals.revenue / totals.spend) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const conversionRate = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0;
  const clickThroughRate = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
  
  const targetProgress = Math.min((totals.revenue / (Number(monthlyTarget) || 1)) * 100, 100);

  // --- Chart Data ---
  const funnelData = [
    { name: 'Показы', value: totals.impressions, fill: '#94a3b8', icon: Eye },
    { name: 'Клики', value: totals.clicks, fill: '#60a5fa', icon: MousePointerClick },
    { name: 'Лиды', value: totals.leads, fill: '#818cf8', icon: Users },
    { name: 'Продажи', value: totals.purchases, fill: '#22c55e', icon: ShoppingBag },
  ];

  const chartData = useMemo(() => {
    if (filterChannel === 'all') {
      const byChannel: Record<string, { name: string, spend: number, revenue: number, roas: number }> = {};
      currentMonthData.forEach(d => {
        if (!byChannel[d.channel]) byChannel[d.channel] = { name: d.channel, spend: 0, revenue: 0, roas: 0 };
        byChannel[d.channel].spend += (Number(d.spend) || 0);
        byChannel[d.channel].revenue += (Number(d.revenue) || 0);
      });
      return Object.values(byChannel).map(item => ({
        ...item,
        roas: item.spend > 0 ? parseFloat(((item.revenue / item.spend) * 100).toFixed(0)) : 0
      })).sort((a, b) => b.revenue - a.revenue);
    } else {
      const byCampaign: Record<string, { name: string, spend: number, revenue: number, roas: number }> = {};
      currentMonthData.forEach(d => {
        if (!byCampaign[d.campaignName]) byCampaign[d.campaignName] = { name: d.campaignName, spend: 0, revenue: 0, roas: 0 };
        byCampaign[d.campaignName].spend += (Number(d.spend) || 0);
        byCampaign[d.campaignName].revenue += (Number(d.revenue) || 0);
      });
      return Object.values(byCampaign).map(item => ({
        ...item,
        roas: item.spend > 0 ? parseFloat(((item.revenue / item.spend) * 100).toFixed(0)) : 0
      })).sort((a, b) => b.revenue - a.revenue);
    }
  }, [currentMonthData, filterChannel]);

  const pieData = useMemo(() => {
     const data = filterChannel === 'all' 
        ? currentMonthData 
        : currentMonthData.filter(d => d.channel === filterChannel);
     
     const grouped = data.reduce((acc, curr) => {
         const key = filterChannel === 'all' ? curr.channel : curr.campaignName;
         if(!acc[key]) acc[key] = 0;
         acc[key] += (Number(curr.revenue) || 0);
         return acc;
     }, {} as Record<string, number>);

     return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5
  }, [currentMonthData, filterChannel]);

  const dailyTrendData = useMemo(() => {
    const daily: Record<string, { date: string, revenue: number, spend: number }> = {};
    const sorted = [...currentMonthData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(d => {
      const day = new Date(d.date).getDate(); // Just day number for chart clarity
      const dateKey = d.date; // Full date for sorting
      if (!daily[dateKey]) daily[dateKey] = { date: d.date, revenue: 0, spend: 0 };
      daily[dateKey].revenue += (Number(d.revenue) || 0);
      daily[dateKey].spend += (Number(d.spend) || 0);
    });
    return Object.values(daily);
  }, [currentMonthData]);

  // --- Handlers ---
  const saveReportsToServer = async (reports: CampaignData[]) => {
      try {
          await fetch(`${crmUrl('/marketing/reports')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify({ reports })
          });
          // Refresh data
          fetchBackendData();
          toast.success('Данные успешно сохранены на сервере');
      } catch (e) {
          toast.error('Ошибка сохранения');
          console.error(e);
      }
  };

  const handleManualImport = () => {
    if (!newReport.campaignName || !newReport.spend) {
      toast.error('Заполните обязательные поля');
      return;
    }
    const reportToAdd: CampaignData = {
      id: Math.random().toString(36).substr(2, 9),
      date: newReport.date || new Date().toISOString().slice(0, 10),
      channel: newReport.channel as any,
      campaignName: newReport.campaignName || 'Unnamed',
      spend: Number(newReport.spend) || 0,
      impressions: Number(newReport.impressions) || 0,
      clicks: Number(newReport.clicks) || 0,
      leads: Number(newReport.leads) || 0,
      purchases: Number(newReport.purchases) || 0,
      revenue: Number(newReport.revenue) || 0,
    };
    
    saveReportsToServer([reportToAdd]);
    setIsImportOpen(false);
    resetForm();
  };

  const handleFileImport = () => {
    if (!fileToUpload) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const newItems: CampaignData[] = [];
        
        // Detect delimiter: check header or first data line
        const headerLine = lines[0] || '';
        const delimiter = headerLine.includes(';') ? ';' : ',';
        
        const startIndex = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('дата') ? 1 : 0;

        const parseNum = (val: string) => {
             if (!val) return 0;
             // Remove spaces (1 000 -> 1000), replace comma with dot (1,5 -> 1.5)
             const clean = val.replace(/\s/g, '').replace(',', '.');
             const num = parseFloat(clean);
             return isNaN(num) ? 0 : num;
        };

        const parseDate = (str: string) => {
            if(!str) return new Date().toISOString().slice(0, 10);
            // Handle DD.MM.YYYY format common in RU/Excel
            if(str.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
                const [d, m, y] = str.split('.');
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            return str;
        };

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(delimiter);
          if (cols.length < 3) continue;

          // Assumes columns: Date, Campaign, Spend, Impressions, Clicks, Leads, Purchases, Revenue
          const spend = parseNum(cols[2]);
          
          if (spend >= 0 || cols[1]) {
            newItems.push({
              id: Math.random().toString(36).substr(2, 9),
              date: parseDate(cols[0]?.trim()),
              channel: newReport.channel as any,
              campaignName: cols[1]?.trim() || 'Imported Campaign',
              spend: spend,
              impressions: parseNum(cols[3]),
              clicks: parseNum(cols[4]),
              leads: parseNum(cols[5]),
              purchases: parseNum(cols[6]),
              revenue: parseNum(cols[7])
            });
          }
        }
        if (newItems.length > 0) {
            saveReportsToServer(newItems);
            setIsImportOpen(false);
            resetForm();
        } else {
            toast.error('Не удалось прочитать данные. Проверьте формат CSV.');
        }
      } catch (err) {
        toast.error('Ошибка при чтении файла');
        console.error(err);
      }
    };
    // Use windows-1251 to correctly read Russian CSV files from Excel
    reader.readAsText(fileToUpload, 'windows-1251');
  };

  const handleUpdateTarget = async () => {
      try {
          await fetch(`${crmUrl('/marketing/target')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify({ target: Number(monthlyTarget) || 0 })
          });
          setIsTargetDialogOpen(false);
          toast.success('Цель обновлена');
      } catch (e) {
          toast.error('Ошибка обновления цели');
      }
  };

  const handleAddEvent = async (event: any) => {
      try {
          await fetch(`${crmUrl('/marketing/events')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify(event)
          });
          fetchBackendData();
          toast.success('Событие добавлено');
      } catch(e) {
          toast.error('Ошибка создания события');
      }
  };

  const handleDeleteEvent = async (id: string) => {
      try {
          await fetch(`${crmUrl(`/marketing/events/${id}`)}`, {
              method: 'DELETE',
              headers: { ...authHeaders() }
          });
          fetchBackendData();
          toast.success('Событие удалено');
      } catch(e) {
          toast.error('Ошибка удаления');
      }
  };

  const handleDeleteReport = async (id: string) => {
      if (!confirm('Вы уверены, что хотите удалить эту запись?')) return;
      try {
          await fetch(`${crmUrl(`/marketing/reports/${id}`)}`, {
              method: 'DELETE',
              headers: { ...authHeaders() }
          });
          toast.success('Запись удалена');
          fetchBackendData();
      } catch (e) {
          toast.error('Ошибка удаления');
          console.error(e);
      }
  };

  const handleGenerateExampleData = async () => {
    if (!confirm('Это добавит тестовые данные на последние 60 дней. Продолжить?')) return;
    
    const channels = ['Instagram - Bententrade', 'Google Ads', 'OLX'];
    const campaigns = ['Пряжа Лето 2025', 'Распродажа Зима', 'Бренд', 'Ретаргетинг', 'Поиск пряжи', 'Шерсть Опт', 'Хлопок Розница'];
    
    const newReports: CampaignData[] = [];
    const today = new Date();
    
    // Generate data for last 60 days
    for (let i = 0; i < 60; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        
        // Randomly generate 1-3 entries per day
        const entriesCount = Math.floor(Math.random() * 3) + 1;
        
        for(let j=0; j<entriesCount; j++) {
            const channel = channels[Math.floor(Math.random() * channels.length)];
            const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
            
            // Random metrics
            const spend = Math.floor(Math.random() * 1000000) + 100000; // 100k - 1.1M
            const roasMultiplier = Math.random() * 8; // 0 to 8 ROAS
            const revenue = Math.floor(spend * roasMultiplier);
            
            newReports.push({
                id: `marketing:report:gen-${Math.random().toString(36).substr(2, 9)}`,
                date: dateStr,
                channel: channel as any,
                campaignName: campaign,
                spend: spend,
                impressions: Math.floor(spend / 50),
                clicks: Math.floor(spend / 1000),
                leads: Math.floor(spend / 20000),
                purchases: Math.floor(spend / 100000),
                revenue: revenue
            });
        }
    }
    
    await saveReportsToServer(newReports);
    toast.success('Тестовые данные добавлены');
  };

  const resetForm = () => {
    setNewReport({
      date: new Date().toISOString().slice(0, 10),
      channel: 'Instagram - Bententrade',
      spend: '', revenue: '', campaignName: '',
      impressions: '', clicks: '', leads: '', purchases: ''
    });
    setFileToUpload(null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val);
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Маркетинг Enterprise</h1>
          <p className="text-slate-500 mt-1">Центр управления ростом и планирования</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
             <Popover>
               <PopoverTrigger asChild>
                 <Button
                   variant={"outline"}
                   className={cn(
                     "w-[240px] justify-start text-left font-normal bg-white border-slate-300",
                     !dateRange && "text-muted-foreground"
                   )}
                 >
                   <CalendarIcon className="mr-2 h-4 w-4" />
                   {dateRange?.from ? (
                     dateRange.to ? (
                       <>
                         {format(dateRange.from, "dd MMM", { locale: ru })} -{" "}
                         {format(dateRange.to, "dd MMM", { locale: ru })}
                       </>
                     ) : (
                       format(dateRange.from, "dd MMM", { locale: ru })
                     )
                   ) : (
                     <span>Выберите период</span>
                   )}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="end">
                 <Calendar
                   initialFocus
                   mode="range"
                   defaultMonth={dateRange?.from}
                   selected={dateRange}
                   onSelect={setDateRange}
                   numberOfMonths={2}
                   locale={ru}
                 />
               </PopoverContent>
             </Popover>

             <Select value={filterChannel} onValueChange={setFilterChannel}>
               <SelectTrigger className="w-[200px] bg-white">
                 <SelectValue placeholder="Выберите канал" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Все каналы</SelectItem>
                 {availableChannels.map(ch => (
                     <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                 ))}
               </SelectContent>
             </Select>

             <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
               <DialogTrigger asChild>
                 <Button variant="outline" className="border-slate-300">
                   <Target className="mr-2 h-4 w-4" /> Цель: {formatLargeNumber(Number(monthlyTarget) || 0)}
                 </Button>
               </DialogTrigger>
               <DialogContent>
                 <DialogHeader>
                   <DialogTitle>Установить цель по продажам</DialogTitle>
                   <DialogDescription>Укажите желаемую сумму продаж на текущий месяц</DialogDescription>
                 </DialogHeader>
                 <div className="py-4">
                   <Label>Цель (UZS)</Label>
                   <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} className="mt-2"/>
                 </div>
                 <DialogFooter>
                   <Button onClick={handleUpdateTarget}>Сохранить</Button>
                 </DialogFooter>
               </DialogContent>
             </Dialog>

             <Button variant="outline" className="border-slate-300" onClick={handleGenerateExampleData}>
                 <Wand2 className="mr-2 h-4 w-4" /> Демо-данные
             </Button>

             <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Добавить отчет
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Импорт данных</DialogTitle>
                  <DialogDescription>Заполните форму или загрузите CSV</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="manual" value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="manual">Вручную</TabsTrigger>
                    <TabsTrigger value="file">Загрузить файл</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual">
                    <div className="grid gap-4 py-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label>Источник</Label>
                           <Select value={newReport.channel} onValueChange={(v) => setNewReport({...newReport, channel: v as any})}>
                             <SelectTrigger><SelectValue /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Instagram - Bententrade">Instagram - Bententrade</SelectItem>
                               <SelectItem value="Instagram - Bententrade.kz">Instagram - Bententrade.kz</SelectItem>
                               <SelectItem value="Google Ads">Google Ads</SelectItem>
                               <SelectItem value="OLX">OLX</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Дата</Label>
                          <Input type="date" value={newReport.date} onChange={e => setNewReport({...newReport, date: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                         <Label>Название кампании</Label>
                         <Input placeholder="Например: Пряжа Опт 2024" value={newReport.campaignName} onChange={e => setNewReport({...newReport, campaignName: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="grid gap-2"><Label>Расход (UZS)</Label><Input type="number" value={newReport.spend} onChange={e => setNewReport({...newReport, spend: e.target.value})} /></div>
                         <div className="grid gap-2"><Label>Продажи (UZS)</Label><Input type="number" value={newReport.revenue} onChange={e => setNewReport({...newReport, revenue: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2"><Label>Клики</Label><Input type="number" value={newReport.clicks} onChange={e => setNewReport({...newReport, clicks: e.target.value})} /></div>
                        <div className="grid gap-2"><Label>Лиды</Label><Input type="number" value={newReport.leads} onChange={e => setNewReport({...newReport, leads: e.target.value})} /></div>
                        <div className="grid gap-2"><Label>Продажи (шт)</Label><Input type="number" value={newReport.purchases} onChange={e => setNewReport({...newReport, purchases: e.target.value})} /></div>
                      </div>
                    </div>
                    <DialogFooter className="mt-4"><Button onClick={handleManualImport}>Сохранить</Button></DialogFooter>
                  </TabsContent>
                  <TabsContent value="file">
                     <div className="bg-slate-50 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <Input type="file" accept=".csv" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} />
                     </div>
                     <DialogFooter className="mt-4"><Button onClick={handleFileImport} disabled={!fileToUpload}>Импортировать</Button></DialogFooter>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
            <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
            <TabsTrigger value="calendar">Календарь</TabsTrigger>
            <TabsTrigger value="data">Данные</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('revenue')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Продажи (Месяц)</CardTitle>
                    <DollarSign className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatLargeNumber(totals.revenue)}</div>
                    <p className={`text-xs mt-1 ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                        {revenueGrowth >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(revenueGrowth).toFixed(1)}% к прошлому мес.
                    </p>
                    <Progress value={targetProgress} className="h-1 mt-3" />
                    <p className="text-[10px] text-right text-slate-400 mt-1">{targetProgress.toFixed(0)}% от плана</p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('roas')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">ROAS</CardTitle>
                    <TrendingUp className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{roas.toFixed(0)}%</div>
                    <p className="text-xs text-slate-500 mt-1">Окупаемость рекламы</p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('leads')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Лиды</CardTitle>
                    <Users className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totals.leads}</div>
                     <p className={`text-xs mt-1 ${leadsGrowth >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                        {leadsGrowth >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(leadsGrowth).toFixed(1)}%
                    </p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('cpl')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">CPL</CardTitle>
                    <Target className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(cpl)}</div>
                    <p className="text-xs text-slate-500 mt-1">Стоимость заявки</p>
                </CardContent>
            </Card>
          </div>

          {/* Second Row - Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('ctr')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">CTR</CardTitle>
                    <Eye className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{clickThroughRate.toFixed(2)}%</div>
                    <p className="text-xs text-slate-500 mt-1">Кликабельность</p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('conversion')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Конверсия</CardTitle>
                    <Users className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
                    <p className="text-xs text-slate-500 mt-1">Клик → Лид</p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('cpc')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">CPC</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(cpc)}</div>
                    <p className="text-xs text-slate-500 mt-1">Стоимость клика</p>
                </CardContent>
            </Card>
            <Card 
              className="h-full flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedMetric('cpa')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">CPA</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(cpa)}</div>
                    <p className="text-xs text-slate-500 mt-1">Стоимость продажи</p>
                </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Main Chart Section with Tabs */}
             <Tabs value={activeChartTab} onValueChange={setActiveChartTab} className="lg:col-span-2">
                 <Card className="h-full">
                     <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                         <div>
                            <CardTitle>Аналитика продаж</CardTitle>
                            <CardDescription>Обзор эффективности маркетинга</CardDescription>
                         </div>
                         <TabsList>
                            <TabsTrigger value="trend">Динамика</TabsTrigger>
                            <TabsTrigger value="channels">{filterChannel === 'all' ? 'Каналы' : 'Кампании'}</TabsTrigger>
                         </TabsList>
                     </CardHeader>
                     <CardContent>
                        <div ref={setChartContainerRef} style={{ width: '100%', height: 300 }}>
                             {isMounted && chartWidth > 0 && activeChartTab === 'trend' && (
                                 <AreaChart width={chartWidth} height={300} data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tickFormatter={(str) => new Date(str).getDate().toString()} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={(val) => `${(val/1000000).toFixed(0)}M`} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                    <Area type="monotone" dataKey="revenue" name="Продажи" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="spend" name="Расход" stroke="#ef4444" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                                 </AreaChart>
                             )}
                            {isMounted && chartWidth > 0 && activeChartTab === 'channels' && (
                                <BarChart width={chartWidth} height={300} data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                    <Bar dataKey="spend" name="Расход" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Bar dataKey="revenue" name="Продажи" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            )}
                        </div>
                     </CardContent>
                 </Card>
             </Tabs>

             {/* Funnel */}
             <Card className="h-full">
                 <CardHeader><CardTitle>Воронка</CardTitle></CardHeader>
                 <CardContent>
                     <div className="space-y-6">
                        {funnelData.map((stage, i) => (
                             <div key={stage.name} className="relative">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="flex items-center gap-2 text-slate-600"><stage.icon className="w-4 h-4" />{stage.name}</span>
                                     <span className="font-bold">{formatLargeNumber(stage.value)}</span>
                                 </div>
                                 <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full rounded-full transition-all duration-500" 
                                        style={{ 
                                            width: totals.impressions > 0 ? `${(stage.value / totals.impressions) * 100}%` : '0%', 
                                            backgroundColor: stage.fill 
                                        }} 
                                     />
                                 </div>
                             </div>
                        ))}
                     </div>
                 </CardContent>
             </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Smart Analysis Component */}
              <div className="lg:col-span-2 space-y-6">
                 {/* Channel Performance Table */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Сводка по {filterChannel === 'all' ? 'каналам' : 'кампаниям'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{filterChannel === 'all' ? 'Канал' : 'Кампания'}</TableHead>
                                    <TableHead className="text-right">Расход</TableHead>
                                    <TableHead className="text-right">Продажи</TableHead>
                                    <TableHead className="text-right">ROAS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chartData.slice(0, 5).map((item) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-right text-slate-500">{formatCurrency(item.spend)}</TableCell>
                                        <TableCell className="text-right font-bold text-slate-900">{formatCurrency(item.revenue)}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={item.roas > 300 ? 'default' : item.roas > 100 ? 'secondary' : 'destructive'} className={item.roas > 300 ? 'bg-green-500' : ''}>
                                                {item.roas}%
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                 </Card>
                 
                 <SmartAnalysis data={currentMonthData} />
              </div>

              {/* Share of Sales */}
              <Card className="h-full">
                  <CardHeader><CardTitle>Доля продаж</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center">
                      <div ref={setPieChartContainerRef} style={{ width: '100%', height: 250 }} className="relative">
                          {pieChartWidth > 0 && (
                              <PieChart width={pieChartWidth} height={250}>
                                  <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </PieChart>
                          )}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                              <p className="text-xs text-slate-500">Всего</p>
                              <p className="font-bold text-sm">{formatLargeNumber(totals.revenue)}</p>
                          </div>
                      </div>
                      <div className="mt-4 w-full space-y-2">
                          {pieData.map((entry, index) => (
                              <div key={entry.name} className="flex items-center gap-2 text-xs">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                  <span className="flex-1 truncate">{entry.name}</span>
                                  <span className="font-medium">{(entry.value / totals.revenue * 100).toFixed(0)}%</span>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="min-h-[600px] h-full">
             <MarketingCalendar events={filteredEvents} onAddEvent={handleAddEvent} onDeleteEvent={handleDeleteEvent} />
        </TabsContent>

        <TabsContent value="data">
             <Card>
                 <CardHeader><CardTitle>Все данные</CardTitle></CardHeader>
                 <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Кампания</TableHead>
                                <TableHead className="text-right">Расход</TableHead>
                                <TableHead className="text-right">Продажи</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map(row => (
                                <TableRow key={row.id}>
                                    <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{row.campaignName}</span>
                                            <span className="text-[10px] text-slate-500">{row.channel}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.spend)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteReport(row.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </CardContent>
             </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={!!selectedMetric} onOpenChange={(open) => !open && setSelectedMetric(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMetric ? METRIC_DEFINITIONS[selectedMetric].title : ''}</DialogTitle>
            <DialogDescription className="sr-only">
              Детальная информация о метрике
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">Что это?</h4>
              <p className="text-sm text-slate-500">{selectedMetric ? METRIC_DEFINITIONS[selectedMetric].description : ''}</p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Зачем это нужно?</h4>
              <p className="text-sm text-slate-500">{selectedMetric ? METRIC_DEFINITIONS[selectedMetric].why : ''}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}