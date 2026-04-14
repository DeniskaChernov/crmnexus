import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ChevronLeft, ChevronRight, Plus, Rocket, AlertCircle, CalendarDays, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface MarketingEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'campaign' | 'holiday' | 'technical';
  channel?: string;
  description?: string;
}

interface MarketingCalendarProps {
  events: MarketingEvent[];
  onAddEvent: (event: Omit<MarketingEvent, 'id'>) => void;
  onDeleteEvent: (id: string) => void;
}

export function MarketingCalendar({ events, onAddEvent, onDeleteEvent }: MarketingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'campaign',
    channel: 'all',
    description: ''
  });

  // Calendar Calculation Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // First day of current month
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Adjust for Monday start (0 = Mon, 6 = Sun)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  // Generate days array
  const calendarDays = [];
  
  // Previous month days
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      calendarDays.push({ date, isCurrentMonth: false });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      calendarDays.push({ date, isCurrentMonth: true });
  }
  
  // Next month days (fill up to 42 cells for 6 rows)
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      calendarDays.push({ date, isCurrentMonth: false });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  const getEventsForDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const handleAdd = () => {
    if (!newEvent.title) return;
    onAddEvent(newEvent as any);
    setIsDialogOpen(false);
    setNewEvent({ ...newEvent, title: '', description: '' });
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'campaign': return 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100';
      case 'holiday': return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100';
      case 'technical': return 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
        case 'campaign': return <Rocket className="w-3 h-3 mr-1.5" />;
        case 'holiday': return <CalendarDays className="w-3 h-3 mr-1.5" />;
        case 'technical': return <AlertCircle className="w-3 h-3 mr-1.5" />;
        default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between border-b border-slate-100 gap-4">
        <div className="flex items-center gap-4">
           <h2 className="text-2xl font-bold text-slate-900 capitalize min-w-[200px]">{monthName}</h2>
           <div className="flex items-center bg-slate-50 rounded-full p-1 border border-slate-200">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full h-8 w-8 hover:bg-white hover:shadow-sm transition-all"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full h-8 w-8 hover:bg-white hover:shadow-sm transition-all"><ChevronRight className="h-4 w-4" /></Button>
           </div>
           <Button variant="outline" size="sm" onClick={goToToday} className="rounded-full text-xs font-medium border-slate-200 hover:bg-slate-50">Сегодня</Button>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
             <DialogTrigger asChild>
               <Button className="rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10 px-6">
                   <Plus className="h-4 w-4 mr-2" /> Добавить событие
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[425px] rounded-2xl">
               <DialogHeader>
                 <DialogTitle>Новое событие</DialogTitle>
                 <DialogDescription>Запланируйте маркетинговую активность</DialogDescription>
               </DialogHeader>
               <div className="grid gap-5 py-4">
                 <div className="grid gap-2">
                   <Label>Название</Label>
                   <Input 
                     value={newEvent.title} 
                     onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                     placeholder="Например: Летняя распродажа" 
                     className="rounded-xl"
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label>Дата</Label>
                   <Input 
                     type="date" 
                     value={newEvent.date} 
                     onChange={e => setNewEvent({...newEvent, date: e.target.value})} 
                     className="rounded-xl"
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label>Тип активности</Label>
                   <Select value={newEvent.type} onValueChange={v => setNewEvent({...newEvent, type: v as any})}>
                     <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="campaign">Рекламная кампания</SelectItem>
                       <SelectItem value="holiday">Праздник / Инфоповод</SelectItem>
                       <SelectItem value="technical">Технические работы</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <DialogFooter>
                 <Button onClick={handleAdd} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700">Создать событие</Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day, i) => (
              <div key={day} className="py-3 text-center border-r border-slate-100 last:border-0">
                  <span className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-widest">{day}</span>
                  <span className="md:hidden text-[11px] font-bold text-slate-400 uppercase tracking-widest">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</span>
              </div>
          ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 bg-slate-100 gap-px border-b border-slate-100">
         {calendarDays.map((cell, index) => {
             const isToday = new Date().toDateString() === cell.date.toDateString();
             const dayEvents = getEventsForDay(cell.date);
             
             return (
                 <div 
                    key={index} 
                    className={cn(
                        "bg-white p-2 md:p-3 relative group transition-all hover:bg-slate-50/50 flex flex-col gap-2 min-h-[100px]",
                        !cell.isCurrentMonth && "bg-slate-50/30 text-slate-400",
                        isToday && "bg-blue-50/20"
                    )}
                    onClick={() => {
                        setNewEvent({
                            ...newEvent,
                            date: `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`
                        });
                        setIsDialogOpen(true);
                    }}
                 >
                    {/* Date Number */}
                    <div className="flex justify-between items-start">
                        <span className={cn(
                            "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                            isToday 
                              ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                              : "text-slate-700 group-hover:bg-slate-200/50",
                            !cell.isCurrentMonth && "text-slate-400"
                        )}>
                            {cell.date.getDate()}
                        </span>
                        {/* Add button on hover */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
                        >
                            <Plus className="h-3 w-3 text-slate-400" />
                        </Button>
                    </div>

                    {/* Events List */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[120px] custom-scrollbar">
                        {dayEvents.map(ev => (
                            <DropdownMenu key={ev.id}>
                                <DropdownMenuTrigger asChild>
                                    <div 
                                        className={cn(
                                            "text-[10px] md:text-xs px-2 py-1.5 rounded-lg border w-full text-left truncate cursor-pointer transition-all shadow-sm flex items-center gap-1",
                                            getTypeStyles(ev.type)
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                       {getTypeIcon(ev.type)}
                                       <span className="truncate flex-1 font-medium">{ev.title}</span>
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteEvent(ev.id);
                                    }} className="text-red-600 focus:text-red-600 cursor-pointer">
                                        <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ))}
                    </div>
                 </div>
             );
         })}
      </div>
    </div>
  );
}
