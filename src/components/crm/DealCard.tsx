import React, { memo, useMemo } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { 
    MoreHorizontal, 
    Pencil, 
    Trash2, 
    FileText, 
    Plus, 
    ChevronDown, 
    ChevronUp,
    Wallet,
    EyeOff,
    Eye,
    ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'motion/react';

interface DealCardProps {
    deal: any;
    stats: {
        paidTotal: number;
        balance: number;
        percentage: number;
        dealPayments: any[];
    };
    isExcluded?: boolean;
    onView: (deal: any) => void;
    onEdit: (deal: any) => void;
    onDelete: (id: string) => void;
    onAddPayment: (deal: any) => void;
    onDeletePayment: (id: string) => void;
}

export const DealCard = memo(function DealCard({ 
    deal, 
    stats, 
    isExcluded,
    onView,
    onEdit, 
    onDelete, 
    onAddPayment, 
    onDeletePayment 
}: DealCardProps) {
    const isPaid = stats.balance <= 0;
    const sortedPayments = useMemo(
      () =>
        [...stats.dealPayments].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      [stats.dealPayments],
    );

    return (
        <Card className={`tasklab-card border-0 overflow-hidden transition-all hover:shadow-md group cursor-pointer ${
            isPaid ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500'
        } ${isExcluded ? 'opacity-75 bg-neutral-50' : ''}`}
            onClick={() => onView(deal)}
        >
            <div className="flex flex-col md:flex-row">
                
                {/* Left: Deal Info */}
                <div className="p-4 md:p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-lg text-neutral-900 leading-tight flex items-center gap-2 group-hover:text-neutral-900 transition-colors">
                                    {deal.title}
                                    {isExcluded && (
                                        <Badge variant="secondary" className="bg-neutral-200 text-neutral-600 gap-1 text-[10px] h-5 px-1.5 border-neutral-300">
                                            <EyeOff className="w-3 h-3" />
                                            Без учёта
                                        </Badge>
                                    )}
                                </h3>
                                <Badge variant="outline" className={
                                    deal.status === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                    deal.status === 'lost' ? 'bg-red-50 text-red-700 border-red-200' : 
                                    'bg-[var(--tasklab-lime)]/15 text-neutral-900 border-[var(--tasklab-lime)]/30'
                                }>
                                    {deal.status === 'won' ? 'Выиграна' : deal.status === 'lost' ? 'Проиграна' : 'В работе'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-neutral-500 mt-2">
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[150px] md:max-w-xs font-medium text-neutral-700">{deal.companies?.name || 'Нет компании'}</span>
                                {deal.dealer_name && (
                                  <>
                                    <span className="text-neutral-300">•</span>
                                    <span className="text-xs text-emerald-700">🏪 {deal.dealer_name}</span>
                                  </>
                                )}
                                <span className="text-neutral-300">•</span>
                                <span className="text-xs">{format(parseISO(deal.created_at), 'dd MMM yyyy', { locale: ru })}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start pl-2 flex-shrink-0">
                            <div className="text-right hidden sm:block">
                                <div className="text-xl md:text-2xl font-bold text-neutral-900 whitespace-nowrap">
                                    {new Intl.NumberFormat('uz-UZ').format(deal.amount || 0)}
                                </div>
                                <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Сумма</div>
                            </div>
                            {/* Stop propagation for dropdown so it doesn't open the sheet */}
                            <div onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-neutral-400 hover:text-neutral-600">
                                            <MoreHorizontal className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onView(deal)}>
                                            <Eye className="mr-2 h-4 w-4" /> Открыть
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onEdit(deal)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Редактировать
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onAddPayment(deal)}>
                                            <Plus className="mr-2 h-4 w-4" /> Добавить оплату
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onDelete(deal.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                            <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Price Display */}
                    <div className="sm:hidden mb-4 mt-4">
                        <div className="text-3xl font-bold text-neutral-900 tracking-tight">
                            {new Intl.NumberFormat('uz-UZ').format(deal.amount || 0)} <span className="text-lg font-normal text-neutral-400">сум</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm flex-wrap gap-2">
                            <span className="text-neutral-500 text-xs">Оплачено: {stats.percentage.toFixed(0)}%</span>
                            <span className={`text-xs font-bold uppercase tracking-wide ${stats.balance > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                                {stats.balance > 0 ? `Долг: ${new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.balance)}` : "✓ Оплачено"}
                            </span>
                        </div>
                        <Progress value={stats.percentage} className="h-1.5 bg-neutral-100" indicatorClassName={stats.balance > 0 ? 'bg-neutral-900' : 'bg-emerald-500'} />
                    </div>

                    {/* Mobile: Action Buttons */}
                    <div className="md:hidden mt-4 pt-4 border-t border-neutral-100 flex gap-3" onClick={e => e.stopPropagation()}>
                        <Button 
                            variant="outline" 
                            className="flex-1 justify-center gap-2 text-neutral-600 border-neutral-200 h-10 rounded-xl"
                            onClick={() => onView(deal)}
                        >
                            <Eye className="h-4 w-4" />
                            Детали
                        </Button>
                        
                        <Button 
                            className="flex-1 justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 h-10 rounded-xl shadow-sm"
                            onClick={() => onAddPayment(deal)}
                        >
                            <Plus className="h-4 w-4" />
                            Внести
                        </Button>
                    </div>
                </div>

                {/* Right: Payments List & Actions (Desktop only) */}
                <div className="hidden md:flex md:w-[380px] border-l border-neutral-100 bg-neutral-50/60 flex-col">
                    <div className="p-4 md:p-5 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-sm text-neutral-700">История оплат</h4>
                            <div onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 bg-white shadow-sm text-xs" onClick={() => onAddPayment(deal)}>
                                    <Plus className="h-3 w-3" /> Добавить
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5 overflow-y-auto max-h-[140px] -mr-1 pr-1">
                            {stats.dealPayments.length === 0 ? (
                                <div className="text-xs text-neutral-400 text-center py-5 italic bg-white/50 rounded-lg border border-dashed border-neutral-200">
                                    Нет поступлений
                                </div>
                            ) : (
                                sortedPayments.map(payment => (
                                    <div key={payment.id} className="bg-white p-2.5 rounded-lg border border-neutral-100 shadow-sm flex justify-between items-center group/pay" onClick={e => e.stopPropagation()}>
                                        <div>
                                            <div className="font-bold text-emerald-600 text-sm">
                                                +{new Intl.NumberFormat('uz-UZ').format(payment.amount)}
                                            </div>
                                            <div className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                {format(parseISO(payment.date), 'dd.MM.yyyy')}
                                                {payment.note && <span className="truncate max-w-[100px]">· {payment.note}</span>}
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 opacity-0 group-hover/pay:opacity-100 transition-opacity text-neutral-400 hover:text-red-500"
                                            onClick={() => onDeletePayment(payment.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Click hint */}
                        <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-3 h-3" />
                            Нажмите для полных деталей
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
});

DealCard.displayName = 'DealCard';
