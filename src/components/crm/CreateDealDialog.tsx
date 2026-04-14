import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { useForm } from 'react-hook-form@7.55.0';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner@2.0.3';
import { Plus, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { DealItemsEditor, DealItem } from './DealItemsEditor';
interface CreateDealDialogProps {
  onSuccess: () => void;
  // NEW: Allow triggering externally
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: {
    clientName?: string;
    clientPhone?: string;
    description?: string;
  };
}

export function CreateDealDialog({ onSuccess, isOpen, onOpenChange, initialData }: CreateDealDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]); 
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  
  // Form & UI State
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dealItems, setDealItems] = useState<DealItem[]>([]);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Auto-calculate amount from items
  useEffect(() => {
    if (dealItems.length > 0) {
        const cleanVal = (val: any) => {
             if (!val) return 0;
             const str = String(val).replace(/\s/g, '').replace(',', '.');
             const num = parseFloat(str);
             return isNaN(num) ? 0 : num;
        };
        const total = dealItems.reduce((sum, item) => sum + (cleanVal(item.quantity) * cleanVal(item.price)), 0);
        setValue('amount', total);
    }
  }, [dealItems, setValue]);

  // Handle Initial Data (Pre-fill)
  useEffect(() => {
    if (open && initialData) {
        if (initialData.clientName) {
            setClientMode('new');
            setValue('new_client_name', initialData.clientName);
        }
        if (initialData.clientPhone) {
             setValue('new_client_phone', initialData.clientPhone);
        }
        // Could also pre-fill description or items based on initialData if needed
    }
  }, [open, initialData, setValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setComboboxOpen(false);
      }
    };
    
    if (comboboxOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [comboboxOpen]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
        reset();
        setSelectedCompany(null);
        setClientMode('existing');
        setSearchQuery('');
        setDealItems([]);
    }
  }, [open, reset]);

  const fetchData = async () => {
    // Fetch companies
    const { data: companiesData } = await crm.from('companies').select('id, name, phone').order('name');
    
    // Fetch clients from KV store
    let clientsData: any[] = [];
    try {
      const clientsRes = await fetch(`${crmUrl('/clients')}`, {
        headers: { ...authHeaders(false) }
      });
      if (clientsRes.ok) {
        const allClients = await clientsRes.json();
        clientsData = allClients.map((client: any) => ({
          id: client.company_id, 
          name: client.name,
          phone: client.phone,
          isClient: true 
        })).filter((c: any) => c.id); 
      }
    } catch (err) {
      console.log('Failed to fetch clients:', err);
    }
    
    const companiesMap = new Map();
    (companiesData || []).forEach(c => companiesMap.set(c.id, { ...c, isClient: false }));
    clientsData.forEach(c => {
      if (!companiesMap.has(c.id)) {
        companiesMap.set(c.id, c);
      } else {
        companiesMap.set(c.id, { ...companiesMap.get(c.id), isClient: true });
      }
    });
    
    setCompanies(Array.from(companiesMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

    const { data: pipelinesData } = await crm.from('pipelines').select('id, name').order('is_default', { ascending: false });
    setPipelines(pipelinesData || []);
    
    if (pipelinesData && pipelinesData.length > 0) {
        setValue('pipeline_id', pipelinesData[0].id);
    }
    
    setValue('status', 'open');
  };

  const onSubmit = async (data: any) => {
    if (loading) return;
    setLoading(true);
    try {
      const cleanAmount = (val: any) => {
        if (!val) return 0;
        const str = String(val).replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      let finalCompanyId = null;

      if (clientMode === 'existing') {
          if (!selectedCompany) {
              toast.error('Выберите клиента');
              setLoading(false);
              return;
          }
          finalCompanyId = selectedCompany.id;
      } else {
          // Create new company
          if (!data.new_client_name) {
              toast.error('Введите имя клиента');
              setLoading(false);
              return;
          }
          const { data: newComp, error: createError } = await crm
            .from('companies')
            .insert([{ 
                name: data.new_client_name,
                phone: data.new_client_phone,
                status: 'active'
            }])
            .select('id')
            .single();
          
          if (createError) throw createError;
          finalCompanyId = newComp.id;
      }

      // Get first stage of pipeline
      const { data: stageData } = await crm
        .from('stages')
        .select('id')
        .eq('pipeline_id', data.pipeline_id)
        .order('order_index')
        .limit(1)
        .single();

      let finalTitle = `${data.product_type}`;
      if (data.article) finalTitle += ` - Арт. ${data.article}`;
      if (dealItems.length > 0 && !data.article) {
          finalTitle += ` (${dealItems[0].article} + ${dealItems.length - 1} др.)`;
      }

      const { data: newDeal, error } = await crm.from('deals').insert([
        {
          title: finalTitle,
          company_id: finalCompanyId,
          amount: cleanAmount(data.amount),
          stage_id: stageData?.id,
          status: data.status || 'open',
          contact_id: (data.contact_id && data.contact_id !== 'no_contact') ? data.contact_id : null,
        },
      ]).select('id').single();

      if (error) throw error;

      // Save Items
      if (dealItems.length > 0 && newDeal) {
          await fetch(`${crmUrl('/deal-items')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify({
                  dealId: newDeal.id,
                  items: dealItems.map(i => ({ 
                      ...i, 
                      quantity: cleanAmount(i.quantity), 
                      price: cleanAmount(i.price) 
                  }))
              })
          });

          // Create production order for items marked "На заказ"
          const productionItems = dealItems.filter(i => i.article);
          if (productionItems.length > 0) {
              const companyName = clientMode === 'existing'
                  ? (selectedCompany?.name || '')
                  : (data.new_client_name || '');
              const orderRes = await fetch(`${crmUrl('/production-orders')}`, {
                  method: 'POST',
                  headers: { ...authHeaders() },
                  body: JSON.stringify({
                      dealId: newDeal.id,
                      dealTitle: finalTitle,
                      companyName,
                      items: productionItems.map(i => ({
                          article: i.article,
                          quantity: cleanAmount(i.quantity),
                          price: cleanAmount(i.price),
                          warehouse: i.warehouse,
                          type: i.type,
                      }))
                  })
              });
              if (orderRes.ok) {
                  toast.success(`Производственный заказ создан (${productionItems.length} поз.) — виден в Календаре`);
              }
          }
      }

      // Save Stats Exclusion if checked
      if (data.ignoreStats && newDeal) {
          await fetch(`${crmUrl('/deals/exclude')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify({
                  dealId: newDeal.id,
                  excluded: true
              })
          });
      }

      toast.success('Сделка успешно создана');
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating deal:', error);
      toast.error('Ошибка при создании сделки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isOpen && (
        <DialogTrigger asChild>
            <Button>
            <Plus className="mr-2 h-4 w-4" /> Добавить продажу
            </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>
            Заполните информацию о продаже и товарах.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          
          {/* Client Section */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right mt-2">Клиент</Label>
            <div className="col-span-3">
                <Tabs value={clientMode} onValueChange={(v: any) => setClientMode(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-2">
                        <TabsTrigger value="existing">Выбрать</TabsTrigger>
                        <TabsTrigger value="new">Новый</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="existing" className="mt-0">
                        <div className="relative" ref={dropdownRef}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setComboboxOpen(!comboboxOpen)}
                                className="w-full justify-between"
                            >
                                {selectedCompany
                                    ? companies.find((c) => c.id === selectedCompany.id)?.name
                                    : "Выберите клиента..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                            
                            {comboboxOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
                                    <div className="p-2 border-b">
                                        <Input 
                                            placeholder="Поиск клиента..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="h-9"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto p-1">
                                        {companies
                                            .filter((company) => {
                                                if (!searchQuery) return true;
                                                const query = searchQuery.toLowerCase();
                                                return (
                                                    company.name.toLowerCase().includes(query) ||
                                                    (company.phone && company.phone.toLowerCase().includes(query))
                                                );
                                            })
                                            .map((company) => (
                                            <button
                                                key={company.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCompany(company);
                                                    setComboboxOpen(false);
                                                    setSearchQuery('');
                                                }}
                                                className={cn(
                                                    "w-full flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 text-left transition-colors",
                                                    selectedCompany?.id === company.id && "bg-slate-100"
                                                )}
                                            >
                                                <Check
                                                    className={cn(
                                                        "h-4 w-4 mt-0.5 shrink-0",
                                                        selectedCompany?.id === company.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col gap-1 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{company.name}</span>
                                                        {company.isClient && (
                                                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                                                                Клиент
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {company.phone && (
                                                        <span className="text-xs text-muted-foreground">{company.phone}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="new" className="mt-0 space-y-2">
                        <Input placeholder="Имя клиента" {...register('new_client_name')} />
                        <Input placeholder="Телефон" {...register('new_client_phone')} />
                    </TabsContent>
                </Tabs>
            </div>
          </div>

          {/* Basic Deal Info */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Тип товара</Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('product_type', val)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Кашпо">Кашпо</SelectItem>
                  <SelectItem value="Искусственный ротанг">Искусственный ротанг</SelectItem>
                  <SelectItem value="Мебель">Мебель</SelectItem>
                  <SelectItem value="Другое">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="article" className="text-right">Артикул (основной)</Label>
            <Input id="article" className="col-span-3" {...register('article')} placeholder="Необязательно" />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">Общая сумма</Label>
            <Input id="amount" type="number" step="any" className="col-span-3" {...register('amount')} placeholder="0" />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pipeline" className="text-right">Воронка</Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('pipeline_id', val)} defaultValue={pipelines[0]?.id}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите воронку" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-start-2 col-span-3 flex items-center space-x-2">
                <Checkbox 
                    id="ignoreStats" 
                    onCheckedChange={(checked) => setValue('ignoreStats', checked)} 
                />
                <Label htmlFor="ignoreStats" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Не учитывать в финансовой статистике (для бонусов)
                </Label>
            </div>
          </div>

          {/* Items Editor */}
          <div className="col-span-4">
             <DealItemsEditor 
                items={dealItems} 
                onChange={setDealItems} 
                productType={watch('product_type')}
             />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Добавить продажу'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}