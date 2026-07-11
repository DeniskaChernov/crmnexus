import React from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  Briefcase,
  Cloud,
  Clock,
  MoreHorizontal,
  Package,
  Play,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { clientInitials, formatUZS } from '../../lib/formatMoney.ts';

export interface BttTaskLabHomeProps {
  loading?: boolean;
  timeRange: string;
  onTimeRangeChange: (v: string) => void;
  stats: {
    revenue: number;
    activeDeals: number;
    newLeads: number;
    conversion: number;
  };
  chartData: { month: string; amount: number }[];
  hotDeals: any[];
  funnelData: { name: string; value: number; fill: string }[];
  warehouseCurrent?: number;
  monthlyPlan: number;
  planProgress: number;
  teamMembers: { id: string; name: string }[];
  mounted: boolean;
  onOpenPlan: () => void;
  onOpenAi: () => void;
  dashboardError?: string;
}

function HeaderClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return (
    <div className="hidden sm:flex items-center gap-2 tasklab-pill bg-white/80 px-4 py-2 text-sm text-neutral-600">
      <Clock className="w-4 h-4" />
      <span className="font-semibold text-neutral-900">{time}</span>
      <span className="text-neutral-400">·</span>
      <span>{date}</span>
    </div>
  );
}

export function BttTaskLabHome({
  timeRange,
  onTimeRangeChange,
  stats,
  chartData,
  hotDeals,
  funnelData,
  warehouseCurrent = 0,
  monthlyPlan,
  planProgress,
  teamMembers,
  mounted,
  onOpenPlan,
  onOpenAi,
  dashboardError,
}: BttTaskLabHomeProps) {
  const inWorkPct = stats.activeDeals > 0 ? Math.min(72, 40 + stats.conversion) : 34;
  const donePct = 100 - inWorkPct;
  const weekTrend = stats.conversion >= 10 ? 13 : -7;
  const monthTrend = stats.revenue > 0 ? 13 : -4;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">
            Обзор CRM
          </h1>
          <p className="text-neutral-500 mt-1 text-sm md:text-base">
            Продажи, команда и склад BTT Nexus
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderClock />
          <div className="hidden md:flex items-center gap-2 tasklab-pill bg-white/80 px-4 py-2 text-sm text-neutral-600">
            <Cloud className="w-4 h-4" />
            <span>23°C · Облачно</span>
          </div>
          <button
            type="button"
            className="tasklab-pill bg-white/80 p-2.5 text-neutral-600 hover:bg-white relative"
            aria-label="Уведомления"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--tasklab-lime)] ring-2 ring-white" />
          </button>
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="tasklab-pill h-10 min-w-[140px] border-0 bg-white/90 font-semibold shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Этот месяц</SelectItem>
              <SelectItem value="last_month">Прошлый месяц</SelectItem>
              <SelectItem value="this_year">Этот год</SelectItem>
              <SelectItem value="all">Все время</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onOpenAi} variant="outline" className="tasklab-pill border-neutral-200 bg-white">
            <Sparkles className="w-4 h-4 mr-2" /> AI
          </Button>
          <Button onClick={onOpenPlan} className="tasklab-pill bg-neutral-900 text-white hover:bg-neutral-800">
            <Target className="w-4 h-4 mr-2" /> План
          </Button>
        </div>
      </div>

      {dashboardError && (
        <div className="tasklab-card bg-amber-50 text-amber-900 text-sm font-medium px-4 py-3">
          {dashboardError}
        </div>
      )}

      {/* Bento row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="tasklab-card p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-neutral-500">Выручка</p>
              <p className="text-3xl font-bold text-neutral-900 mt-1 tabular-nums">
                {formatUZS(stats.revenue, true)}
              </p>
            </div>
            <MoreHorizontal className="w-5 h-5 text-neutral-300" />
          </div>
          <div className="space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-neutral-100">
              <div className="bg-[var(--tasklab-lime)]" style={{ width: `${inWorkPct}%` }} />
              <div className="bg-sky-300" style={{ width: `${donePct}%` }} />
            </div>
            <div className="flex justify-between text-xs font-medium text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--tasklab-lime)]" /> Сделки
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-300" /> Оплачено
              </span>
            </div>
          </div>
        </div>

        <div className="tasklab-card-lime p-5 md:p-6 text-neutral-900">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-neutral-800/70">Команда</p>
              <p className="text-3xl font-bold mt-1">{teamMembers.length || stats.newLeads} участников</p>
            </div>
            <Users className="w-5 h-5 text-neutral-800/50" />
          </div>
          <div className="flex items-center -space-x-2">
            {(teamMembers.length ? teamMembers : hotDeals.slice(0, 5)).map((m: any, i: number) => (
              <div
                key={m.id || i}
                className="w-10 h-10 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center ring-2 ring-[var(--tasklab-lime)]"
                title={m.name || m.title}
              >
                {clientInitials(m.name || m.companies?.name || m.title)}
              </div>
            ))}
          </div>
        </div>

        <Link
          to="/deals"
          className="tasklab-card-dashed flex flex-col items-center justify-center min-h-[160px] gap-3 hover:border-neutral-400 transition-colors group"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center group-hover:border-[var(--tasklab-lime)] group-hover:bg-[var(--tasklab-lime)]/20 transition-all">
            <Plus className="w-6 h-6 text-neutral-500 group-hover:text-neutral-900" />
          </div>
          <span className="text-sm font-semibold text-neutral-500">Новая сделка</span>
        </Link>
      </div>

      {/* Bento row 2 — chart + side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="tasklab-card-dark xl:col-span-2 p-5 md:p-6 min-h-[280px]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Динамика продаж</h2>
              <p className="text-neutral-400 text-sm mt-0.5">Выручка по месяцам</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-neutral-400">Неделя</p>
                <p className={`font-bold flex items-center gap-1 ${weekTrend >= 0 ? 'text-[var(--tasklab-lime)]' : 'text-red-400'}`}>
                  {weekTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {weekTrend > 0 ? '+' : ''}{weekTrend}%
                </p>
              </div>
              <div>
                <p className="text-neutral-400">Месяц</p>
                <p className={`font-bold flex items-center gap-1 ${monthTrend >= 0 ? 'text-[var(--tasklab-lime)]' : 'text-red-400'}`}>
                  {monthTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {monthTrend > 0 ? '+' : ''}{monthTrend}%
                </p>
              </div>
            </div>
          </div>
          <div className="h-[200px] w-full">
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tasklabArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4F534" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#D4F534" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 16, color: '#fff' }}
                    formatter={(v: number) => [formatUZS(v), '']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#D4F534" strokeWidth={2} fill="url(#tasklabArea)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-500 text-sm">Нет данных за период</div>
            )}
          </div>
        </div>

        <div className="tasklab-card p-5 md:p-6 flex flex-col">
          <h2 className="text-lg font-bold text-neutral-900 mb-1">Воронка</h2>
          <p className="text-sm text-neutral-500 mb-4">{stats.activeDeals} активных сделок</p>
          <div className="flex-1 min-h-[160px]">
            {mounted && funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={14}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || '#d4f534'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-neutral-400">Загрузка воронки…</p>
            )}
          </div>
          <Button variant="outline" className="tasklab-pill mt-4 w-full border-neutral-200" asChild>
            <Link to="/deals">Все сделки</Link>
          </Button>
        </div>
      </div>

      {/* Bento row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="tasklab-card lg:col-span-2 p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Активные сделки</h2>
              <p className="text-sm text-neutral-500">Топ по сумме</p>
            </div>
            <Briefcase className="w-5 h-5 text-neutral-300" />
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
            {hotDeals.length === 0 ? (
              <p className="text-sm text-neutral-400 py-8 text-center">Нет активных сделок</p>
            ) : (
              hotDeals.map((deal) => (
                <Link
                  key={deal.id}
                  to="/deals"
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {clientInitials(deal.companies?.name || deal.title)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{deal.title}</p>
                      <p className="text-xs text-neutral-500 truncate">{deal.companies?.name || '—'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-neutral-900 tabular-nums shrink-0">
                    {formatUZS(deal.amount, true)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="tasklab-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-neutral-400" />
              <h3 className="font-bold text-neutral-900">Склад BTT</h3>
            </div>
            <p className="text-3xl font-bold text-neutral-900 tabular-nums">
              {warehouseCurrent.toFixed(0)} <span className="text-base font-medium text-neutral-500">кг</span>
            </p>
            <Button variant="outline" className="tasklab-pill w-full mt-4 border-neutral-200" asChild>
              <Link to="/warehouse">Открыть склад</Link>
            </Button>
          </div>

          {monthlyPlan > 0 && (
            <div className="tasklab-card-dark p-5">
              <p className="text-neutral-400 text-sm">План продаж</p>
              <p className="text-4xl font-bold text-white mt-2 tabular-nums">{planProgress.toFixed(0)}%</p>
              <div className="h-2 bg-neutral-700 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-[var(--tasklab-lime)] rounded-full transition-all"
                  style={{ width: `${Math.min(planProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">{formatUZS(monthlyPlan, true)}</p>
            </div>
          )}

          <div className="tasklab-card-dark p-5 flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-wide">Конверсия</p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">{stats.conversion.toFixed(1)}%</p>
            </div>
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-[var(--tasklab-lime)] text-neutral-900 flex items-center justify-center hover:scale-105 transition-transform"
              aria-label="Подробнее"
            >
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
