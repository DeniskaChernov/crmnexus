import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Upload,
  Calendar,
  Check,
  CalendarDays,
  MoreHorizontal,
  Star,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { clientInitials, formatUZS } from '../../lib/formatMoney.ts';

export interface SugarTeamMember {
  id: string;
  name: string;
  count: number;
  tone: 'blue' | 'red' | 'orange';
}

export interface SugarWorkflowTask {
  id: string;
  title: string;
  assignee?: string;
  highlight?: boolean;
}

export interface SugarGridTask {
  id: string;
  title: string;
  active?: boolean;
}

export interface SugarKnowledgeRow {
  id: string;
  subject: string;
  status: 'executed' | 'scheduled';
  startDate: string;
  endDate: string;
  assignee: string;
}

export interface SugarHomeProps {
  team: SugarTeamMember[];
  allocationTasks: SugarWorkflowTask[];
  identificationTasks: SugarWorkflowTask[];
  resolutionTasks: SugarWorkflowTask[];
  newTasks: SugarGridTask[];
  knowledgeRows: SugarKnowledgeRow[];
  executedCount: number;
  activeCount: number;
  loading?: boolean;
}

function WidgetActions() {
  return (
    <div className="flex items-center gap-1.5 text-slate-400">
      <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Добавить">
        <Plus className="w-4 h-4" />
      </button>
      <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Загрузить">
        <Upload className="w-4 h-4" />
      </button>
      <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Календарь">
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  );
}

function MiniAvatar({ name }: { name?: string }) {
  const initials = clientInitials(name || '?');
  return (
    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 ring-2 ring-white">
      {initials}
    </div>
  );
}

function TaskRow({ task }: { task: SugarWorkflowTask }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${
        task.highlight ? 'bg-red-50/80 ring-1 ring-red-100' : 'hover:bg-slate-50'
      }`}
    >
      <MiniAvatar name={task.assignee} />
      <span className="flex-1 text-sm text-slate-700 truncate">{task.title}</span>
      <div className="flex items-center gap-1 shrink-0 text-slate-300">
        <Check className="w-4 h-4" />
        <CalendarDays className="w-4 h-4" />
      </div>
    </div>
  );
}

function DonutGauge({
  value,
  label,
  color,
  track,
}: {
  value: number;
  label: string;
  color: string;
  track: string;
}) {
  const pct = Math.min(value / Math.max(value + 5, 10), 0.85);
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-14 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke={track} strokeWidth="10" strokeLinecap="round" />
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${pct * 157} 157`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <span className="text-3xl font-bold text-slate-900 leading-none">{value}</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-2" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

export function SugarHome({
  team,
  allocationTasks,
  identificationTasks,
  resolutionTasks,
  newTasks,
  knowledgeRows,
  executedCount,
  activeCount,
  loading,
}: SugarHomeProps) {
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400 text-sm">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Заголовок + команда */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-5">
          Путь клиента
        </h1>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 custom-scrollbar">
          {team.map((member) => (
            <div key={member.id} className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-bold text-slate-700 ring-4 ring-white shadow-sm">
                {clientInitials(member.name)}
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm ${
                  member.tone === 'red'
                    ? 'bg-[#F87171]'
                    : member.tone === 'orange'
                      ? 'bg-[#FB923C]'
                      : 'bg-[#60A5FA]'
                }`}
              >
                {member.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div className="sugar-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Управление сделками</h2>
          <WidgetActions />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 relative">
          {/* Колонка 1 */}
          <div className="space-y-3">
            {allocationTasks.map((task) => (
              <div key={task.id} className="sugar-inner-card p-4 flex flex-col gap-3 min-h-[120px]">
                <MiniAvatar name={task.assignee} />
                <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
                <div className="flex items-center gap-2 text-slate-300 mt-auto">
                  <Check className="w-4 h-4" />
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>

          {/* Колонка 2 */}
          <div className="sugar-inner-card p-3 space-y-1 min-h-[200px]">
            {identificationTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>

          {/* Колонка 3 */}
          <div className="sugar-inner-card p-3 space-y-1 min-h-[200px]">
            {resolutionTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>

          {/* Колонка 4 — сетка */}
          <div className="grid grid-cols-2 gap-2.5">
            {newTasks.map((task) => (
              <div
                key={task.id}
                className={`relative rounded-2xl p-3 min-h-[88px] flex items-end transition-all ${
                  task.active
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-[1.02]'
                    : 'sugar-inner-card text-slate-800'
                }`}
              >
                <p className="text-xs font-semibold leading-snug">{task.title}</p>
                {task.active && (
                  <ArrowRight className="absolute hidden xl:block w-5 h-5 text-white/60 -left-6 top-1/2 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          {['Распределение', 'Квалификация', 'Закрытие', 'Новые задачи'].map((label) => (
            <p key={label} className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center xl:text-left">
              {label}
            </p>
          ))}
        </div>
      </div>

      {/* Нижние виджеты */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Таблица */}
        <div className="sugar-card p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-lg font-bold text-slate-900">Рекомендуемые задачи</h2>
            </div>
            <WidgetActions />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-3 font-semibold">Тема</th>
                  <th className="pb-3 font-semibold">Статус</th>
                  <th className="pb-3 font-semibold hidden sm:table-cell">Начало</th>
                  <th className="pb-3 font-semibold hidden md:table-cell">Конец</th>
                  <th className="pb-3 font-semibold">Ответственный</th>
                </tr>
              </thead>
              <tbody>
                {knowledgeRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 pr-2 font-medium text-slate-800 max-w-[140px] truncate">{row.subject}</td>
                    <td className="py-3 pr-2">
                      <Badge
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold border-0 ${
                          row.status === 'executed'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                            : 'bg-red-100 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {row.status === 'executed' ? 'Выполнено' : 'Запланировано'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-2 text-slate-500 hidden sm:table-cell">{row.startDate}</td>
                    <td className="py-3 pr-2 text-slate-500 hidden md:table-cell">{row.endDate}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <MiniAvatar name={row.assignee} />
                        <span className="text-slate-600 truncate max-w-[80px]">{row.assignee}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" className="text-slate-400 rounded-full" asChild>
              <Link to="/tasks">
                <MoreHorizontal className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Донаты */}
        <div className="sugar-card p-5 md:p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900">Воронка сделок</h2>
            <WidgetActions />
          </div>
          <div className="flex items-center justify-center gap-12 md:gap-16 py-4">
            <DonutGauge value={executedCount} label="Закрыто" color="#60A5FA" track="#E0F2FE" />
            <DonutGauge value={activeCount} label="Активно" color="#F87171" track="#FEE2E2" />
          </div>
        </div>
      </div>
    </div>
  );
}
