import React from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, ArrowRight, Mail, Calendar } from 'lucide-react';
import { SendEmailDialog } from '../SendEmailDialog';

interface Deal {
  id: string;
  title: string;
  description?: string;
  amount: number;
  stage_id: string;
  status: 'open' | 'won' | 'lost';
  expected_close_date?: string;
  contact_id?: string;
  company_id?: string;
  created_at: string;
  updated_at?: string;
  companies?: {
    name: string;
  };
  contacts?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
  order_index: number;
}

interface DraggableDealCardProps {
  deal: Deal;
  stages: Stage[];
  currentStageName: string;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: 'open' | 'won' | 'lost') => void;
  onMove: (id: string, stageId: string) => void;
}

export const DraggableDealCard = ({ 
  deal, 
  stages, 
  currentStageName, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  onMove 
}: DraggableDealCardProps) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'DEAL',
    item: { id: deal.id, stageId: deal.stage_id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [deal.id, deal.stage_id]);

  const isOverdue = deal.expected_close_date && new Date(deal.expected_close_date) < new Date() && deal.status === 'open';
  const isHot = (deal.amount || 0) >= 10000000;
  const statusColor = deal.status === 'won' ? 'border-l-green-500' : deal.status === 'lost' ? 'border-l-red-500' : 'border-l-blue-500';

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <Card className={`group relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-0 shadow-sm bg-white ${deal.status !== 'open' ? 'opacity-70' : ''} cursor-grab active:cursor-grabbing overflow-hidden select-none`}>
        {/* Status Line Indicator (Soft) */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${deal.status === 'won' ? 'bg-green-400' : deal.status === 'lost' ? 'bg-red-400' : 'bg-blue-400'}`} />

        {/* Status & Hot Badge */}
        <div className="absolute top-3 left-4 flex gap-1 z-10">
          {isHot && deal.status === 'open' && (
            <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm shadow-orange-200">🔥 Горячая</Badge>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full shadow-sm shadow-red-200">Просрочена</Badge>
          )}
        </div>

        {/* Hover Actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white rounded-full">
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(deal)} className="rounded-lg cursor-pointer">
                <Pencil className="mr-2 h-4 w-4" /> Редактировать
              </DropdownMenuItem>
              {deal.contacts?.email && (
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <div className="w-full">
                    <SendEmailDialog
                      recipientEmail={deal.contacts.email}
                      recipientName={`${deal.contacts.first_name} ${deal.contacts.last_name}`}
                      dealTitle={deal.title}
                      trigger={
                        <div className="flex items-center w-full">
                          <Mail className="mr-2 h-4 w-4" /> Отправить email
                        </div>
                      }
                    />
                  </div>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(deal.id)} className="text-red-600 focus:text-red-600 rounded-lg cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4" /> Удалить
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Статус</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onStatusChange(deal.id, 'open')} disabled={deal.status === 'open'} className="rounded-lg cursor-pointer">
                🟢 Открыто
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(deal.id, 'won')} disabled={deal.status === 'won'} className="rounded-lg cursor-pointer">
                ✅ Выиграно
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(deal.id, 'lost')} disabled={deal.status === 'lost'} className="rounded-lg cursor-pointer">
                ❌ Проиграно
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Переместить в...</DropdownMenuLabel>
              {stages
                .sort((a, b) => a.order_index - b.order_index)
                .map((s) => (
                <DropdownMenuItem 
                  key={s.id} 
                  onClick={() => onMove(deal.id, s.id)}
                  disabled={s.name === currentStageName}
                  className="rounded-lg cursor-pointer"
                >
                  <ArrowRight className="mr-2 h-4 w-4 opacity-50" />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card Content */}
        <CardHeader className="p-4 pb-2 pr-10 pt-8">
          <CardTitle 
            className="text-sm font-bold leading-tight mb-1 cursor-pointer hover:text-blue-600 transition-colors" 
            onClick={() => onEdit(deal)}
          >
            {deal.title}
          </CardTitle>
          <div className="text-xs text-slate-500 font-medium truncate flex items-center gap-1">
            {deal.companies?.name || 'Без клиента'}
          </div>
          {deal.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{deal.description}</p>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {/* Amount and Date */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">
              {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(deal.amount || 0)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
              {new Date(deal.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          {/* Additional Info */}
          <div className="space-y-1">
            {deal.expected_close_date && (
              <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(deal.expected_close_date).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};