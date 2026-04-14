import React, { useEffect, useState, useMemo } from 'react';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Search, Download, Calendar, ArrowUpDown, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import { downloadCSV, formatDateForExport, formatCurrencyForExport } from '../../utils/exportUtils';

interface ArchivedDeal {
  id: string;
  title: string;
  amount: number;
  status: 'won' | 'lost';
  created_at: string;
  updated_at: string;
  expected_close_date?: string;
  stage_id: string;
  companies?: {
    name: string;
  };
  contacts?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

export default function DealsArchive() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<ArchivedDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'past_months' | 'this_month'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchArchivedDeals();
  }, []);

  const fetchArchivedDeals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await crm
        .from('deals')
        .select('*, companies(name), contacts(first_name, last_name, email, phone)')
        .in('status', ['won', 'lost'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching archived deals:', error);
      toast.error('Не удалось загрузить архив сделок');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // 1. Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        deal.title.toLowerCase().includes(searchLower) ||
        deal.companies?.name?.toLowerCase().includes(searchLower) ||
        deal.contacts?.email?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // 2. Status
      if (statusFilter !== 'all' && deal.status !== statusFilter) return false;

      // 3. Period
      if (periodFilter !== 'all') {
        const dealDate = new Date(deal.updated_at || deal.created_at);
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (periodFilter === 'past_months') {
          // Show only deals from BEFORE the current month
          if (dealDate >= startOfCurrentMonth) return false;
        } else if (periodFilter === 'this_month') {
          // Show only deals from THIS month
          if (dealDate < startOfCurrentMonth) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [deals, searchTerm, statusFilter, periodFilter, sortOrder]);

  const handleExport = () => {
    if (filteredDeals.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const exportData = filteredDeals.map(deal => ({
      'Название': deal.title,
      'Клиент': deal.companies?.name || 'Без компании',
      'Контакт': deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '',
      'Сумма (UZS)': formatCurrencyForExport(deal.amount),
      'Статус': deal.status === 'won' ? 'Выиграно' : 'Проиграно',
      'Дата закрытия': formatDateForExport(deal.updated_at || deal.created_at),
    }));

    downloadCSV(exportData, `deals-archive-${new Date().toISOString().split('T')[0]}`);
    toast.success('Архив экспортирован');
  };

  const totalAmount = filteredDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  return (
    <div className="h-full flex flex-col space-y-6 p-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/deals')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Архив сделок</h2>
            <p className="text-muted-foreground text-sm">
              Всего: {filteredDeals.length} • Сумма: {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0 }).format(totalAmount)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="grid gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или клиенту..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
           <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="won">✅ Выигранные</SelectItem>
              <SelectItem value="lost">❌ Проигранные</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Весь период</SelectItem>
              <SelectItem value="past_months">📁 Прошлые месяцы</SelectItem>
              <SelectItem value="this_month">📅 Текущий месяц</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            title="Сортировать по дате"
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md bg-white shadow-sm overflow-hidden flex-1">
        <div className="overflow-auto h-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Название</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата закрытия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Сделки не найдены
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <TableRow key={deal.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{deal.title}</span>
                        {deal.expected_close_date && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                План: {new Date(deal.expected_close_date).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{deal.companies?.name || '—'}</span>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{deal.contacts?.email}</span>
                            {deal.contacts?.phone && <span className="text-xs text-slate-500">{deal.contacts.phone}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0 }).format(deal.amount || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={deal.status === 'won' ? 'default' : 'destructive'} className={deal.status === 'won' ? 'bg-green-600 hover:bg-green-700' : ''}>
                        {deal.status === 'won' ? 'Выиграно' : 'Проиграно'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(deal.updated_at || deal.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}