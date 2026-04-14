import { useState } from 'react';
import { Button } from '../ui/button';
import { Calendar, X } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  onReset: () => void;
}

export function DateRangePicker({ startDate, endDate, onDateChange, onReset }: DateRangePickerProps) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  const handleApply = () => {
    onDateChange(localStart, localEnd);
  };

  const presets = [
    { label: 'Сегодня', getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }},
    { label: 'Эта неделя', getValue: () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);
      return { 
        start: weekStart.toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
      };
    }},
    { label: 'Этот месяц', getValue: () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { 
        start: monthStart.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }},
    { label: 'Последние 30 дней', getValue: () => {
      const today = new Date();
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      return { 
        start: past30.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }},
    { label: 'Последние 90 дней', getValue: () => {
      const today = new Date();
      const past90 = new Date(today);
      past90.setDate(today.getDate() - 90);
      return { 
        start: past90.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }},
    { label: 'Этот год', getValue: () => {
      const today = new Date();
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { 
        start: yearStart.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }},
  ];

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Период:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button size="sm" onClick={handleApply}>
            Применить
          </Button>

          {(startDate || endDate) && (
            <Button size="sm" variant="outline" onClick={onReset}>
              <X className="h-3 w-3 mr-1" />
              Сбросить
            </Button>
          )}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => {
                const { start, end } = preset.getValue();
                setLocalStart(start);
                setLocalEnd(end);
                onDateChange(start, end);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
