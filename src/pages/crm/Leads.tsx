import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '../../components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Search, Phone, Info, Trash2, Pencil, RefreshCw, FileSpreadsheet, CheckCircle2, XCircle, Calendar, Download, Briefcase, Copy, CheckSquare, Square, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { CreateDealDialog } from '../../components/crm/CreateDealDialog';
import { Checkbox } from '../../components/ui/checkbox';
import { motion, AnimatePresence } from 'motion/react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  info: string;
  status: 'new' | 'processed';
  country: string;
  createdAt: string;
}

const COUNTRIES = [
  { id: 'Russia', label: 'Россия' },
  { id: 'Uzbekistan', label: 'Узбекистан' },
  { id: 'Kazakhstan', label: 'Казахстан' },
  { id: 'Kyrgyzstan', label: 'Киргизия' },
  { id: 'Tajikistan', label: 'Таджикистан' },
  { id: 'Turkmenistan', label: 'Туркменистан' }
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCountry, setActiveCountry] = useState('Russia');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    info: '', 
    country: 'Russia',
    status: 'new' as 'new' | 'processed'
  });

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Conversion State
  const [isDealOpen, setIsDealOpen] = useState(false);
  const [dealInitialData, setDealInitialData] = useState<any>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  // Clear selection when changing country
  useEffect(() => {
    setSelectedLeads([]);
  }, [activeCountry]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${crmUrl('/leads')}`, {
        headers: { ...authHeaders(false) }
      });
      
      if (!response.ok) throw new Error('Failed to fetch leads');
      
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка загрузки лидов');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Заполните имя и телефон');
      return;
    }

    try {
      const url = editingLead 
        ? `${crmUrl(`/leads/${editingLead.id}`)}`
        : `${crmUrl('/leads')}`;
        
      const method = editingLead ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { ...authHeaders() },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success(editingLead ? 'Лид обновлен' : 'Лид добавлен');
      setIsAddOpen(false);
      setEditingLead(null);
      setFormData({ name: '', phone: '', info: '', country: activeCountry, status: 'new' });
      fetchLeads();
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить лида?')) return;
    
    try {
      const response = await fetch(`${crmUrl(`/leads/${id}`)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(false) }
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      toast.success('Лид удален');
      fetchLeads();
      // Remove from selection if selected
      setSelectedLeads(prev => prev.filter(lid => lid !== id));
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
        toast.error('Выберите CSV файл');
        return;
    }
    
    try {
        setImporting(true);
        const text = await importFile.text();
        const rows = text.split('\n');
        
        let successCount = 0;
        let failCount = 0;

        // Skip header if it exists
        const startIndex = rows[0].toLowerCase().includes('phone') || rows[0].toLowerCase().includes('телефон') ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;

            const cols = row.split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
            const phone = cols[0];
            const name = cols[1] || 'Без имени';
            const info = cols[2] || '';

            if (phone.length < 5) {
                failCount++;
                continue;
            }

            try {
                await fetch(`${crmUrl('/leads')}`, {
                    method: 'POST',
                    headers: { ...authHeaders() },
                    body: JSON.stringify({
                        phone,
                        name,
                        info,
                        country: activeCountry,
                        status: 'new'
                    })
                });
                successCount++;
            } catch (e) {
                failCount++;
            }
        }
        
        toast.success(`Импорт завершен: ${successCount} успешно, ${failCount} ошибок`);
        setIsImportOpen(false);
        setImportFile(null);
        fetchLeads();
    } catch (e: any) {
        toast.error(e.message || "Ошибка чтения файла");
    } finally {
        setImporting(false);
    }
  };

  const handleConvertToDeal = (lead: Lead) => {
      setDealInitialData({
          clientName: lead.name,
          clientPhone: lead.phone,
          description: lead.info,
          leadId: lead.id
      });
      setIsDealOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      phone: lead.phone,
      info: lead.info,
      country: lead.country,
      status: lead.status
    });
    setIsAddOpen(true);
  };

  const openAdd = () => {
    setEditingLead(null);
    setFormData({ 
      name: '', 
      phone: '', 
      info: '', 
      country: activeCountry, 
      status: 'new'
    });
    setIsAddOpen(true);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, id]);
    } else {
      setSelectedLeads(prev => prev.filter(lid => lid !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Удалить выбранные лиды (${selectedLeads.length})?`)) return;

    // We have to delete one by one as backend is simple
    let successCount = 0;
    for (const id of selectedLeads) {
        try {
            await fetch(`${crmUrl(`/leads/${id}`)}`, {
                method: 'DELETE',
                headers: { ...authHeaders(false) }
            });
            successCount++;
        } catch (e) {
            console.error(e);
        }
    }
    toast.success(`Удалено ${successCount} лидов`);
    setSelectedLeads([]);
    fetchLeads();
  };

  const handleBulkStatus = async (status: 'new' | 'processed') => {
    let successCount = 0;
    // We need to fetch current data to merge, or just send partial update if backend supported (it supports PUT with full object usually, let's see handleSave logic)
    // handleSave does full PUT. We need to be careful.
    // Actually, backend PUT /leads/:id replaces the object.
    
    // Efficient way: find lead in local state, update status, send PUT.
    for (const id of selectedLeads) {
        const lead = leads.find(l => l.id === id);
        if (!lead) continue;
        
        try {
            await fetch(`${crmUrl(`/leads/${id}`)}`, {
                method: 'PUT',
                headers: { ...authHeaders() },
                body: JSON.stringify({
                    ...lead,
                    status
                })
            });
            successCount++;
        } catch (e) {
             console.error(e);
        }
    }
    toast.success(`Обновлено ${successCount} лидов`);
    setSelectedLeads([]);
    fetchLeads();
  };

  const toggleStatus = async (lead: Lead) => {
    const newStatus = lead.status === 'new' ? 'processed' : 'new';
    try {
        // Optimistic update
        setLeads(leads.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));

        const response = await fetch(`${crmUrl(`/leads/${lead.id}`)}`, {
            method: 'PUT',
            headers: { ...authHeaders() },
            body: JSON.stringify({
                ...lead,
                status: newStatus
            })
        });

        if (!response.ok) throw new Error('Failed');
        toast.success(`Статус изменен на: ${newStatus === 'new' ? 'Новый' : 'Обработан'}`);
    } catch (e) {
        toast.error('Ошибка обновления статуса');
        fetchLeads(); // Revert
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => toast.success('Скопировано'))
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
      try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          
          // Avoid scrolling to bottom
          textArea.style.top = "0";
          textArea.style.left = "0";
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
              toast.success('Скопировано');
          } else {
              throw new Error('Fallback failed');
          }
      } catch (err) {
          toast.error('Не удалось скопировать автоматически');
          console.error('Copy failed', err);
      }
  }

  const filteredLeads = leads
    .filter(l => l.country === activeCountry)
    .filter(l => 
      l.name.toLowerCase().includes(search.toLowerCase()) || 
      l.phone.includes(search) ||
      l.info.toLowerCase().includes(search.toLowerCase())
    );

  const stats = {
    total: filteredLeads.length,
    processed: filteredLeads.filter(l => l.status === 'processed').length,
    new: filteredLeads.filter(l => l.status === 'new').length
  };

  const allSelected = filteredLeads.length > 0 && selectedLeads.length === filteredLeads.length;

  return (
    <div className="space-y-4 relative">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Лиды ({COUNTRIES.find(c => c.id === activeCountry)?.label})
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600" onClick={() => setIsHelpOpen(true)}>
                    <Info className="h-4 w-4" />
                </Button>
              </CardTitle>
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Всего: {stats.total}</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Обработано: {stats.processed}</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Новые: {stats.new}</span>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Поиск по имени или телефону..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={() => setIsImportOpen(true)} className="bg-green-100 text-green-700 hover:bg-green-200">
                <Download className="h-4 w-4 mr-2" /> Импорт
              </Button>
              <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Добавить
              </Button>
              <Button variant="outline" size="icon" onClick={fetchLeads} title="Обновить">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCountry} onValueChange={setActiveCountry} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 mb-4 bg-slate-100">
              {COUNTRIES.map(country => (
                <TabsTrigger key={country.id} value={country.id} className="px-4 py-2">
                  {country.label}
                  <Badge variant="secondary" className="ml-2 text-[10px] h-4 bg-slate-200 text-slate-600">
                    {leads.filter(l => l.country === country.id).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="rounded-md border relative">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                        <Checkbox 
                            checked={allSelected} 
                            onCheckedChange={toggleSelectAll} 
                            aria-label="Select all"
                        />
                    </TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Лид</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Инфо</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">Загрузка...</TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        В этой категории нет лидов. Добавьте первого или импортируйте из CSV!
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => {
                        const isSelected = selectedLeads.includes(lead.id);
                        return (
                          <TableRow key={lead.id} className={isSelected ? 'bg-blue-50/50' : ''}>
                            <TableCell>
                                <Checkbox 
                                    checked={isSelected} 
                                    onCheckedChange={(checked) => toggleSelectOne(lead.id, checked as boolean)}
                                />
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(lead.createdAt).toLocaleDateString()}
                                </div>
                            </TableCell>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 group">
                                <span className="text-sm font-mono">{lead.phone}</span>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(lead.phone)} title="Копировать">
                                        <Copy className="h-3 w-3 text-slate-400 hover:text-blue-600" />
                                    </Button>
                                    <a href={`tel:${lead.phone}`}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Позвонить">
                                            <Phone className="h-3 w-3 text-slate-400 hover:text-green-600" />
                                        </Button>
                                    </a>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-md truncate" title={lead.info}>
                              {lead.info || <span className="text-slate-400 italic">Нет информации</span>}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={lead.status === 'processed' ? 'secondary' : 'default'}
                                className={`cursor-pointer select-none transition-colors ${
                                  lead.status === 'processed' 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                onClick={() => toggleStatus(lead)}
                              >
                                {lead.status === 'processed' ? 'Обработан' : 'Новый'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleConvertToDeal(lead)} title="Создать сделку" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                    <Briefcase className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(lead)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(lead.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bulk Actions Floating Bar */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
            <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6"
            >
                <span className="text-sm font-medium whitespace-nowrap">Выбрано: {selectedLeads.length}</span>
                <div className="h-4 w-px bg-slate-700" />
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-white hover:bg-slate-800 hover:text-white"
                        onClick={() => handleBulkStatus('processed')}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
                        В обработанные
                    </Button>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-white hover:bg-slate-800 hover:text-white"
                        onClick={() => handleBulkStatus('new')}
                    >
                        <RefreshCw className="h-4 w-4 mr-2 text-blue-400" />
                        В новые
                    </Button>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-white hover:bg-red-900/50 hover:text-red-300"
                        onClick={handleBulkDelete}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                    </Button>
                </div>
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="ml-2 h-6 w-6 p-0 rounded-full hover:bg-slate-800"
                    onClick={() => setSelectedLeads([])}
                >
                    <XCircle className="h-4 w-4" />
                </Button>
            </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Редактировать лида' : 'Новый лид'}</DialogTitle>
            <DialogDescription>
              Введите данные о потенциальном клиенте
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Имя / Название</Label>
              <Input 
                placeholder="Иван Иванов" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label>Номер телефона</Label>
              <Input 
                placeholder="+998..." 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label>Страна</Label>
              <Select 
                value={formData.country} 
                onValueChange={v => setFormData({...formData, country: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Информация по звонку</Label>
              <Textarea 
                placeholder="Что интересовало клиента..." 
                value={formData.info}
                onChange={e => setFormData({...formData, info: e.target.value})}
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Label className="flex-1">Статус обработки</Label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant={formData.status === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({...formData, status: 'new'})}
                  className={formData.status === 'new' ? 'bg-blue-600' : ''}
                >
                  Новый
                </Button>
                <Button 
                  type="button"
                  variant={formData.status === 'processed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({...formData, status: 'processed'})}
                  className={formData.status === 'processed' ? 'bg-green-600' : ''}
                >
                  Обработан
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Импорт из CSV</DialogTitle>
                <DialogDescription>
                    Импортируйте лидов для: <b>{COUNTRIES.find(c => c.id === activeCountry)?.label}</b>.
                    <br/>
                    Формат CSV: <b>Телефон; Имя; Инфо</b> (разделитель ; или ,)
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Файл CSV</Label>
                    <Input 
                        type="file"
                        accept=".csv"
                        onChange={e => setImportFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-slate-500">Загрузите файл с номерами для прозвона</p>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportOpen(false)}>Отмена</Button>
                <Button onClick={handleImport} disabled={importing || !importFile} className="bg-green-600 hover:bg-green-700">
                    {importing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Начать импорт
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <CreateDealDialog 
        isOpen={isDealOpen} 
        onOpenChange={setIsDealOpen}
        onSuccess={() => {
            setIsDealOpen(false);
            if (dealInitialData?.leadId) {
                // If converted from lead, delete the lead or mark as processed
                // Since user wants separation "Dirty" vs "Golden", we delete from Dirty
                handleDelete(dealInitialData.leadId);
            } else {
                fetchLeads();
            }
        }}
        initialData={dealInitialData}
      />

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    Как работает CRM BTT NEXUS
                </DialogTitle>
                <DialogDescription>
                    Логика разделения базы данных на "Лиды" и "Клиенты"
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">1</div>
                            Лиды (Песочница)
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Это "грязная" база контактов. Сюда вы загружаете тысячи номеров (Excel/Google) для массового прозвона. 
                            Здесь находятся те, кто еще <b>не подтвердил</b> интерес.
                        </p>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs">2</div>
                            Клиенты (Золотой актив)
                        </h3>
                        <p className="text-sm text-blue-800 leading-relaxed">
                            Это "чистая" база. Сюда попадают только проверенные контакты, с которыми началась работа (создана сделка).
                            Здесь хранится история покупок и LTV.
                        </p>
                    </div>
                </div>

                <div className="relative pl-8 border-l-2 border-slate-200 space-y-8">
                    <div className="relative">
                        <div className="absolute -left-[39px] bg-slate-100 border-4 border-white shadow-sm w-6 h-6 rounded-full flex items-center justify-center">
                            <Download className="w-3 h-3 text-slate-500" />
                        </div>
                        <h4 className="font-medium text-slate-900">1. Импорт</h4>
                        <p className="text-sm text-slate-500">Загружаете "холодную" базу в раздел Лиды.</p>
                    </div>
                    <div className="relative">
                        <div className="absolute -left-[39px] bg-slate-100 border-4 border-white shadow-sm w-6 h-6 rounded-full flex items-center justify-center">
                            <Phone className="w-3 h-3 text-slate-500" />
                        </div>
                        <h4 className="font-medium text-slate-900">2. Квалификация</h4>
                        <p className="text-sm text-slate-500">Менеджер звонит по списку. Отсеивает нецелевых, отмечает результаты.</p>
                    </div>
                    <div className="relative">
                        <div className="absolute -left-[39px] bg-green-100 border-4 border-white shadow-sm w-6 h-6 rounded-full flex items-center justify-center">
                            <Briefcase className="w-3 h-3 text-green-600" />
                        </div>
                        <h4 className="font-medium text-slate-900">3. Конвертация</h4>
                        <p className="text-sm text-slate-500">
                            Если клиент проявил интерес — нажимаете кнопку <b>"Портфель"</b>. 
                            <br/>
                            <span className="text-green-600 font-medium">Результат:</span> Лид удаляется из "грязной" базы и создается как Клиент + Сделка.
                        </p>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button onClick={() => setIsHelpOpen(false)}>Всё понятно</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}