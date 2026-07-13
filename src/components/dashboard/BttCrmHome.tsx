import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientInitials, formatUZS } from '../../lib/formatMoney.ts';

export interface BttCrmFlowTask {
  id: string;
  title: string;
  subtitle: string;
  face: string;
}

export interface BttCrmGanttItem {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
}

export interface BttCrmHomeProps {
  activeTasksCount: number;
  completedTasksCount: number;
  openDealsCount: number;
  revenue: number;
  teamCount: number;
  teamFaces: string[];
  flowColumns: {
    title: string;
    tasks: BttCrmFlowTask[];
  }[];
  nextStages: string[];
  ganttItems: BttCrmGanttItem[];
  chartBars: number[];
  calendarMarkedDays?: number[];
  calendarBusyDays?: number[];
  notificationCount?: number;
  nextTaskLabel?: string;
  warehouseStock?: number;
  dashboardError?: string;
  onNewBoard?: () => void;
  onOpenAi?: () => void;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
}

const NEXT_DEFAULT = [
  'Обработка',
  'Проблема',
  'Связь с клиентом',
  'Проверка качества',
  'Уведомление',
  'Получение',
];

const BAR_CHARS = ['▂', '▃', '▄', '▅', '▆', '▇'] as const;

function HeaderClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return (
    <>
      <span>
        {time} <small>{date}</small>
      </span>
    </>
  );
}

function barsToString(bars: number[]): string {
  if (!bars.length) return '▂▂▂▂▂▂▂▂▂▂▂▂';
  return bars
    .map((h) => BAR_CHARS[Math.min(BAR_CHARS.length - 1, Math.max(0, Math.round((h / 100) * (BAR_CHARS.length - 1))))])
    .join('');
}

export function BttCrmHome({
  activeTasksCount,
  completedTasksCount,
  openDealsCount,
  revenue,
  teamCount,
  teamFaces,
  flowColumns,
  nextStages = NEXT_DEFAULT,
  ganttItems,
  chartBars,
  calendarMarkedDays = [],
  calendarBusyDays = [],
  notificationCount = 0,
  nextTaskLabel,
  warehouseStock = 0,
  dashboardError,
  onNewBoard,
  onOpenAi,
  timeRange = 'this_month',
  onTimeRangeChange,
}: BttCrmHomeProps) {
  const [pickedStage, setPickedStage] = useState('Связь с клиентом');
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const monthLabel = useMemo(
    () => today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    [],
  );
  const monthName = useMemo(() => today.toLocaleDateString('ru-RU', { month: 'long' }), []);

  const daysInMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    [],
  );
  const firstWeekday = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  const totalTasks = activeTasksCount + completedTasksCount;
  const inWorkPct = totalTasks > 0 ? Math.round((activeTasksCount / totalTasks) * 100) : 0;
  const donePct = 100 - inWorkPct;

  return (
    <>
      <header>
        <div>
          <h1>Главная</h1>
          <p>Управляйте заказами и командой в одном пространстве</p>
        </div>
        <div className="btt-toptools">
          <Link to="/tasks" className="no-underline" style={{ color: 'inherit' }}>
            ◔ <b>{notificationCount}</b>
          </Link>
          <HeaderClock />
          <button type="button" aria-label="AI-аналитика" onClick={onOpenAi}>
            ◐
          </button>
          {onTimeRangeChange && (
            <select
              className="rounded-[14px] border border-[#dfe3db] bg-white px-3 py-2 text-xs font-semibold"
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              aria-label="Период"
            >
              <option value="this_month">Этот месяц</option>
              <option value="last_month">Прошлый месяц</option>
              <option value="this_year">Этот год</option>
              <option value="all">Все время</option>
            </select>
          )}
          {nextTaskLabel ? (
            <Link to="/tasks" className="meeting running no-underline" style={{ color: 'inherit' }}>
              ☑　{nextTaskLabel}
              <small>Ближайшая задача</small>
            </Link>
          ) : (
            <Link to="/deals" className="meeting no-underline" style={{ color: 'inherit' }}>
              □ <b>{openDealsCount}</b>
              <small>Открытых заказов</small>
            </Link>
          )}
        </div>
      </header>

      {dashboardError && (
        <div className="mb-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dashboardError}
        </div>
      )}

      <div className="btt-stats">
        <article>
          <b>Активные задачи</b>
          <Link to="/tasks" className="btt-arrow" aria-label="Задачи">
            ↗
          </Link>
          <strong>{activeTasksCount}</strong>
          <div className="btt-bar">
            <i style={{ width: `${inWorkPct}%` }} />
          </div>
          <small>
            ● В работе {inWorkPct}%　 ● Завершено {donePct}%
          </small>
        </article>

        <article className="btt-lime-card">
          <b>Основная команда</b>
          <small>
            {teamCount} {teamCount === 1 ? 'сотрудник' : teamCount < 5 ? 'сотрудника' : 'сотрудников'}
          </small>
          <div className="btt-face-row">
            {teamFaces.slice(0, 3).map((f, i) => (
              <span key={i} className="btt-face">
                {f}
              </span>
            ))}
            {teamCount > 3 && <span className="count">+{teamCount - 3}</span>}
          </div>
        </article>

        <button type="button" className="btt-addboard" onClick={onNewBoard}>
          ⊕<b>Цель продаж</b>
        </button>

        <article className="btt-insight">
          <b>Выручка за период</b>
          <Link to="/sales-analytics" className="btt-arrow" aria-label="Аналитика">
            ↗
          </Link>
          <strong style={{ fontSize: '1.35rem', display: 'block', margin: '0.35rem 0' }}>
            {formatUZS(revenue, true)}
          </strong>
          <div className="btt-bars">{barsToString(chartBars)}</div>
          <small>
            Склад: {warehouseStock.toLocaleString('ru-RU')} кг · Заказы: {openDealsCount}
          </small>
        </article>
      </div>

      <section className="btt-journey">
        <div className="btt-flow-wrap">
          {flowColumns.map((col, colIdx) => (
            <div key={col.title} className={colIdx === flowColumns.length - 1 ? 'btt-next' : 'btt-column'}>
              {colIdx < flowColumns.length - 1 ? (
                <div className="btt-flow-card">
                  {col.tasks.length ? (
                    col.tasks.map((task) => (
                      <Link key={task.id} to="/tasks" className="btt-row no-underline" style={{ color: 'inherit' }}>
                        <span className="btt-face">{task.face}</span>
                        <div>
                          <b>{task.title}</b>
                          <small>{task.subtitle}</small>
                        </div>
                        <span className="menu">···</span>
                        <i className="check">□</i>
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-[#959b94] px-2 py-4">Нет задач в этой колонке</p>
                  )}
                </div>
              ) : (
                <div className="btt-next-grid">
                  {nextStages.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={pickedStage === stage ? 'picked' : ''}
                      onClick={() => setPickedStage(stage)}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              )}
              <h3>{col.title}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="btt-lower">
        <article className="btt-schedule">
          <div className="btt-section-head">
            <b>График выполнения</b>
            <span>{monthLabel}</span>
          </div>
          <div className="btt-timeline">
            <div className="btt-process">
              <b>Процессы</b>
              <span>В работе ({activeTasksCount})</span>
              <span>Заказы ({openDealsCount})</span>
              <span>Завершено ({completedTasksCount})</span>
            </div>
            <div className="btt-gantt">
              {ganttItems.length ? (
                ganttItems.map((g) => (
                  <i key={g.id} style={{ left: `${g.left}%`, top: `${g.top}%`, width: `${g.width}%` }}>
                    {g.label}
                  </i>
                ))
              ) : (
                <span className="text-xs text-[#959b94] absolute left-3 top-1/2 -translate-y-1/2">
                  Нет задач с дедлайном в этом месяце
                </span>
              )}
            </div>
          </div>
        </article>

        <article className="btt-history">
          <b>Календарь заказов</b>
          <Link to="/deals" className="btt-arrow" aria-label="Заказы">
            ↗
          </Link>
          <small>
            Выбран день: {selectedDay} {monthName}
          </small>
          <div className="btt-days">ПН　ВТ　СР　ЧТ　ПТ　СБ　ВС</div>
          <div className="btt-calendar">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isBusy = calendarBusyDays.includes(day);
              const isMarked = calendarMarkedDays.includes(day);
              const isSelected = day === selectedDay;
              const isToday = day === today.getDate();
              return (
                <button
                  key={day}
                  type="button"
                  className={`${isBusy || isMarked ? 'black' : ''} ${isSelected ? 'selected-day' : ''} ${isToday && !isSelected ? 'today-day' : ''}`.trim()}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <footer>
            ‹ <b>{monthLabel}</b> ›
          </footer>
        </article>
      </section>
    </>
  );
}

export function facesFromNames(names: string[]): string[] {
  return names.map((n) => clientInitials(n).slice(0, 1) || '·');
}
