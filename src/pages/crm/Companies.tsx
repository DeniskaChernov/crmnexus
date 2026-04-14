import React, { useEffect, useState } from 'react';
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
import { AlertCircle, RefreshCcw, Search, User, Trash2, Flame, Snowflake, Sun, Pencil, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { downloadCSV, formatDateForExport } from '../../utils/exportUtils';
import { useIsMobile } from '../../components/ui/use-mobile';

interface Lead {
  id: string;
  name: string;
  type: string;
  city: string;
  status: string;
  phone: string;
  created_at: string;
}

export default function Companies() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
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
      console.error('Error fetching leads:', err);
      setError(err.message || 'Не удалось загрузить лиды');
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

      toast.success('Лид удалён');
      fetchLeads();
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      toast.error('Ошибка при удалении лида');
    } finally {
      setDeletingLead(false);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setEditDialogOpen(true);
  };

  const exportLeads = () => {
    if (filteredLeads.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const statusMap: Record<string, string> = {
      'hot': 'Горячий',
      'warm': 'Тёплый',
      'cold': 'Холодный',
      'new': 'Новый'
    };

    const exportData = filteredLeads.map(lead => ({
      'Название': lead.name,
      'Телефон': lead.phone || '',
      'Тип': lead.type || '',
      'Город': lead.city || '',
      'Статус': statusMap[lead.status] || lead.status,
      'Дата создания': formatDateForExport(lead.created_at)
    }));

    downloadCSV(exportData, `leads-${new Date().toISOString().split('T')[0]}`);
    toast.success('Лиды экспортированы');
  };

  // Filter by Search and Tab
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
                          (lead.city && lead.city.toLowerCase().includes(search.toLowerCase())) ||
                          (lead.phone && lead.phone.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTab = activeTab === 'all' || lead.status === activeTab;

    return matchesSearch && matchesTab;
  });

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
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            <Snowflake className="mr-1 h-3 w-3" />
            Холодный
          </span>
        );
      case 'new':
        return (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
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
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            {status || 'Неизвестно'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">B2B</h2>
          <p className="text-muted-foreground">Компании и организации</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={exportLeads} className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" />
            {isMobile ? 'Экспорт' : 'Экспорт'}
          </Button>
          <CreateCompanyDialog onSuccess={fetchLeads} />
        </div>
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
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, городу или телефону..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Все{!isMobile && ' лиды'}</TabsTrigger>
            <TabsTrigger value="cold" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                <Snowflake className="mr-0 sm:mr-2 h-4 w-4" />
                {!isMobile && 'Холодные'}
            </TabsTrigger>
            <TabsTrigger value="warm" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                <Sun className="mr-0 sm:mr-2 h-4 w-4" />
                {!isMobile && 'Тёплые'}
            </TabsTrigger>
            <TabsTrigger value="hot" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                <Flame className="mr-0 sm:mr-2 h-4 w-4" />
                {!isMobile && 'Горячие'}
            </TabsTrigger>
          </TabsList>

          {/* Mobile Card View */}
          {isMobile ? (
            <div className="mt-4 space-y-3">
              {loading ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Загрузка...
                  </CardContent>
                </Card>
              ) : filteredLeads.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <User className="h-8 w-8 mb-2 opacity-20" />
                      <p>Лиды не найдены</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredLeads.map((lead) => (
                  <Card key={lead.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{lead.name}</h3>
                          {getStatusBadge(lead.status)}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditLead(lead)} 
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
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
                      <div className="space-y-1.5 text-sm text-muted-foreground">
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
            <div className="mt-4 rounded-md border bg-white overflow-hidden">
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
                      <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <User className="h-8 w-8 mb-2 opacity-20" />
                          <p>Лиды не найдены</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.phone || '-'}</TableCell>
                        <TableCell>{getStatusBadge(lead.status)}</TableCell>
                        <TableCell>{lead.type || '-'}</TableCell>
                        <TableCell>{lead.city || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditLead(lead)} 
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
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
      </div>

      {editingLead && (
        <EditCompanyDialog
          company={editingLead}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchLeads}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление лида</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить лид {leadToDelete?.name}?
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
    </div>
  );
}