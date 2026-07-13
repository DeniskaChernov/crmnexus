import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useChunkedList } from '../../hooks/useChunkedList';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Card, CardContent } from '../../components/ui/card';
import { CreateCompanyDialog } from '../../components/crm/CreateCompanyDialog';
import { EditCompanyDialog } from '../../components/crm/EditCompanyDialog';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { AlertCircle, RefreshCcw, Search, User, Trash2, Flame, Snowflake, Sun, Pencil, Download, Loader2, KeyRound } from 'lucide-react';
import { DealerAccessDialog } from '../../components/crm/DealerAccessDialog';
import { toast } from 'sonner@2.0.3';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { downloadCSV, formatDateForExport } from '../../utils/exportUtils';
import { useIsMobile } from '../../components/ui/use-mobile';
import { useCrmAiClient } from '../../context/CrmAiClientContext.tsx';

interface Lead {
  id: string;
  name: string;
  type?: string;
  city?: string;
  status: string;
  phone?: string;
  created_at: string;
  customer_type?: string;
  dealer_portal_enabled?: boolean;
}

export default function Companies() {
  const { setFocus, clearFocus } = useCrmAiClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [activeTab, setActiveTab] = useState('all');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [dealerAccessCompany, setDealerAccessCompany] = useState<Lead | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await crm
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      console.error('Error fetching companies:', err);
      setError(err.message || 'Не удалось загрузить компании');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (lead: Lead) => {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  };

  const deleteLead = async () => {
    if (!leadToDelete) return;

    setDeletingLead(true);
    try {
      const { error } = await crm
        .from('companies')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) throw error;

      toast.success('Компания удалена');
      fetchLeads();
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      toast.error('Ошибка при удалении компании');
    } finally {
      setDeletingLead(false);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setEditDialogOpen(true);
    setFocus({ kind: "company", id: lead.id, label: lead.name });
  };

  const filteredLeads = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        (lead.city && lead.city.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)) ||
        (lead.type && lead.type.toLowerCase().includes(q));

      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'dealers'
            ? Boolean(lead.dealer_portal_enabled || lead.customer_type === 'dealer')
            : lead.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [leads, deferredSearch, activeTab]);

  const { visibleItems: visibleLeads, sentinelRef, hasMore, visibleCount, total: leadsTotal } =
    useChunkedList(filteredLeads, `${activeTab}|${deferredSearch}`, 30);

  const exportLeads = () => {
    if (filteredLeads.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const statusMap: Record<string, string> = {
      'hot': 'Горячий',
      'warm': 'Тёплый',
      'cold': 'Холодный',
      'new': 'Новый',
      'active': 'Активный',
    };

    const exportData = filteredLeads.map(lead => ({
      'Название': lead.name,
      'Телефон': lead.phone || '',
      'Тип': lead.type || '',
      'Город': lead.city || '',
      'Статус': statusMap[lead.status] || lead.status,
      'Дата создания': formatDateForExport(lead.created_at)
    }));

    downloadCSV(exportData, `companies-${new Date().toISOString().split('T')[0]}`);
    toast.success('Компании экспортированы');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'hot':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            <Flame className="mr-1 h-3 w-3" />
            Горячий
          </span>
        );
      case 'warm':
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
            <Sun className="mr-1 h-3 w-3" />
            Тёплый
          </span>
        );
      case 'cold':
        return (
          <span className="inline-flex items-center rounded-full bg-[var(--tasklab-lime)]/25 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
            <Snowflake className="mr-1 h-3 w-3" />
            Холодный
          </span>
        );
      case 'new':
        return (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
              Новый
            </span>
          );
      case 'active':
          return (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Активный
            </span>
          );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
            {status || 'Неизвестно'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={exportLeads} className="flex-1 sm:flex-none">
          <Download className="mr-2 h-4 w-4" />
          {isMobile ? 'Экспорт' : 'Экспорт'}
        </Button>
        <CreateCompanyDialog onSuccess={fetchLeads} />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchLeads} className="ml-4 bg-white text-red-600 hover:bg-red-50 border-red-200">
              <RefreshCcw className="mr-2 h-3 w-3" />
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Поиск по названию, городу или телефону..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap gap-1 h-auto justify-stretch p-1">
            <TabsTrigger value="all" className="flex-1 min-w-[4.5rem]">Все</TabsTrigger>
            <TabsTrigger value="dealers" className="flex-1 min-w-[4.5rem]">
              Дилеры
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="flex-1 min-w-[4.5rem] data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
            >
              Активные
            </TabsTrigger>
            <TabsTrigger value="cold" className="flex-1 min-w-[4.5rem] data-[state=active]:bg-[var(--tasklab-lime)]/25 data-[state=active]:text-neutral-900">
              <Snowflake className="mr-0 sm:mr-1 h-4 w-4 shrink-0" />
              {!isMobile && 'Холодные'}
            </TabsTrigger>
            <TabsTrigger value="warm" className="flex-1 min-w-[4.5rem] data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
              <Sun className="mr-0 sm:mr-1 h-4 w-4 shrink-0" />
              {!isMobile && 'Тёплые'}
            </TabsTrigger>
            <TabsTrigger value="hot" className="flex-1 min-w-[4.5rem] data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
              <Flame className="mr-0 sm:mr-1 h-4 w-4 shrink-0" />
              {!isMobile && 'Горячие'}
            </TabsTrigger>
          </TabsList>

          {/* Mobile Card View */}
          {isMobile ? (
            <div className="mt-4 space-y-3">
              {loading ? (
                <Card>
                  <CardContent className="py-8 text-center text-neutral-500">
                    Загрузка...
                  </CardContent>
                </Card>
              ) : filteredLeads.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-neutral-500">
                      <User className="h-8 w-8 mb-2 opacity-20" />
                      <p>Компании не найдены</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                visibleLeads.map((lead) => (
                  <Card key={lead.id} className="tasklab-card overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1 flex items-center gap-2 flex-wrap">
                            {lead.name}
                            {(lead.dealer_portal_enabled || lead.customer_type === 'dealer') && (
                              <Badge variant="secondary" className="text-[10px]">Портал</Badge>
                            )}
                          </h3>
                          {getStatusBadge(lead.status)}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDealerAccessCompany(lead)} 
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8 w-8 p-0"
                            title="Доступ в портал дилера"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditLead(lead)} 
                            className="text-neutral-900 hover:text-neutral-800 hover:bg-neutral-100 h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteClick(lead)} 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm text-neutral-500">
                        {lead.phone && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Телефон:</span>
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.type && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Тип:</span>
                            <span>{lead.type}</span>
                          </div>
                        )}
                        {lead.city && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Город:</span>
                            <span>{lead.city}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            /* Desktop Table View */
            <div className="mt-4 tasklab-card rounded-[1.75rem] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя / Название</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Город</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">Загрузка...</TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-32 text-neutral-500">
                        <div className="flex flex-col items-center justify-center">
                          <User className="h-8 w-8 mb-2 opacity-20" />
                          <p>Компании не найдены</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {lead.name}
                            {(lead.dealer_portal_enabled || lead.customer_type === 'dealer') && (
                              <Badge variant="secondary" className="text-[10px]">Портал</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{lead.phone || '-'}</TableCell>
                        <TableCell>{getStatusBadge(lead.status)}</TableCell>
                        <TableCell>{lead.type || '-'}</TableCell>
                        <TableCell>{lead.city || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setDealerAccessCompany(lead)} 
                              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                              title="Доступ в портал дилера"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditLead(lead)} 
                              className="text-neutral-900 hover:text-neutral-800 hover:bg-neutral-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteClick(lead)} 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Tabs>

        {!loading && leadsTotal > 0 && (
          <div className="text-center">
            <div ref={sentinelRef} className="h-3 w-full" aria-hidden />
            {hasMore && (
              <p className="text-xs text-neutral-500 pt-1">
                Загружено {visibleCount} из {leadsTotal}
              </p>
            )}
          </div>
        )}
      </div>

      {editingLead && (
        <EditCompanyDialog
          company={editingLead}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) clearFocus();
          }}
          onSuccess={fetchLeads}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление компании</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить компанию «{leadToDelete?.name}»?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteLead}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingLead ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Удалить'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DealerAccessDialog
        company={dealerAccessCompany}
        open={Boolean(dealerAccessCompany)}
        onOpenChange={(open) => !open && setDealerAccessCompany(null)}
      />
    </div>
  );
}