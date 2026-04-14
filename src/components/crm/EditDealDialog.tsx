import React, { useEffect, useState } from 'react';
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
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner@2.0.3';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '../ui/utils';
import { DealItemsEditor, DealItem } from './DealItemsEditor';
import { createShipmentsForDeal } from '../../utils/crm/shipmentHelpers';
import { addTimelineEvent, getTimeline, TimelineEvent } from '../../utils/crm/timeline';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Clock, User } from 'lucide-react';

interface EditDealDialogProps {
  deal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditDealDialog({ deal, open, onOpenChange, onSuccess }: EditDealDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dealItems, setDealItems] = useState<DealItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const { register, handleSubmit, reset, setValue } = useForm();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (deal && open) {
       // ... existing code ...
       loadTimeline();
    }
  }, [deal, open]);

  const loadTimeline = async () => {
    if (deal?.id) {
        const events = await getTimeline(deal.id);
        setTimeline(events);
    }
  };

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

  useEffect(() => {
    if (deal && open) {
      setValue('title', deal.title);
      setValue('amount', deal.amount);
      setValue('status', deal.status || 'open');
      setValue('contact_id', deal.contact_id || 'no_contact');
      setValue('stage_id', deal.stage_id || '');

      // Set selected company if exists
      if (deal.company_id && companies.length > 0) {
        const company = companies.find(c => c.id === deal.company_id);
        if (company) {
          setSelectedCompany(company);
        }
      }

      // Fetch Items
      fetchItems(deal.id);
    }
  }, [deal, open, setValue, companies]);

  // Auto-calculate amount from items ONLY if user explicitly wants to? 
  // Or just warn? For now let's just calculate but let user override if they type in the box
  // Actually, simpler to just let the user manage it, but we can show the sum in the editor.
  // If I force setValue here, it might override manual changes if I'm not careful.
  // I'll skip auto-set on Edit for now to be safe, or add a button.
  // But wait, Create dialog does it. Consistency?
  // Let's do it but only if items change.
  // Note: This will trigger on initial load too, which is fine.
  useEffect(() => {
     if (dealItems.length > 0) {
         const cleanVal = (val: any) => {
             if (!val) return 0;
             const str = String(val).replace(/\s/g, '').replace(',', '.');
             const num = parseFloat(str);
             return isNaN(num) ? 0 : num;
         };
         const total = dealItems.reduce((sum, item) => sum + (cleanVal(item.quantity) * cleanVal(item.price)), 0);
         // Only update if the current amount is 0 or undefined, OR if we want to enforce it.
         // Let's enforce it for now as it's a "System".
         setValue('amount', total);
     }
  }, [dealItems, setValue]);


  const fetchData = async () => {
    // Fetch companies
    const { data: companiesData } = await crm
      .from('companies')
      .select('id, name, phone')
      .order('name');
    setCompanies(companiesData || []);

    // Fetch contacts (optional)
    try {
      const { data: contactsData } = await crm
        .from('contacts')
        .select('id, first_name, last_name, email')
        .order('first_name');
      setContacts(contactsData || []);
    } catch (err) {
      console.log('Contacts table not available');
      setContacts([]);
    }

    // Fetch stages
    const { data: stagesData } = await crm
      .from('stages')
      .select('*')
      .order('order_index');
    setStages(stagesData || []);
  };

  const fetchItems = async (dealId: string) => {
      try {
        const res = await fetch(`${crmUrl(`/deal-items/${dealId}`)}`, {
            headers: { ...authHeaders(false) }
        });
        if (res.ok) {
            const items = await res.json();
            if (Array.isArray(items)) {
                setDealItems(items);
            }
        }
      } catch (e) {
          console.error("Failed to fetch items", e);
      }
  };

  const handleCreateShipment = async () => {
    // Check if any item has missing data
    const validItems = dealItems.filter(i => i.article && (parseFloat(String(i.quantity).replace(',', '.')) || 0) > 0 && i.type !== 'production');
    
    if (validItems.length === 0) {
       if (dealItems.length > 0) {
           toast.error("Нет товаров для отгрузки со склада (позиции 'на заказ' пропускаются)");
       } else {
           toast.error("Заполните артикул и количество");
       }
       return;
    }

    if (!confirm(`Будет создана отгрузка для ${validItems.length} позиций. Продолжить?`)) return;

    setCreatingShipment(true);
    try {
        await createShipmentsForDeal(deal, dealItems, selectedCompany?.name || deal?.companies?.name, false);
    } catch (error: any) {
        // Error already handled in helper (toast shown), but we catch here to stop loading state
    } finally {
        setCreatingShipment(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const cleanAmount = (val: any) => {
        if (!val) return 0;
        const str = String(val).replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const parsedAmount = cleanAmount(data.amount);

      const updates = {
          title: data.title,
          amount: parsedAmount,
          status: data.status,
          contact_id: (data.contact_id && data.contact_id !== 'no_contact') ? data.contact_id : null,
          stage_id: data.stage_id,
          company_id: selectedCompany?.id || null,
      };

      const response = await fetch(`${crmUrl('/deals/update-with-automation')}`, {
          method: 'POST',
          headers: { ...authHeaders() },
          body: JSON.stringify({
              id: deal.id,
              updates: updates,
              previousStatus: deal.status,
              previousStageId: deal.stage_id
          })
      });

      if (!response.ok) {
          throw new Error("Failed to update deal");
      }

      // Save Items
      await fetch(`${crmUrl('/deal-items')}`, {
          method: 'POST',
          headers: { ...authHeaders() },
          body: JSON.stringify({
              dealId: deal.id,
              items: dealItems.map(i => ({ 
                  ...i, 
                  quantity: cleanAmount(i.quantity), 
                  price: cleanAmount(i.price) 
              }))
          })
      });

      // Log Update
      await addTimelineEvent(deal.id, {
         type: 'update',
         message: 'Информация о сделке обновлена'
      });

      // Auto-create shipment if won (and it wasn't won before)
      if (data.status === 'won' && deal.status !== 'won') {
          // Use current dealItems as they are the most up-to-date
          try {
              await createShipmentsForDeal(deal, dealItems, selectedCompany?.name || deal?.companies?.name, true);
          } catch (shipmentError) {
              console.error("Failed to auto-create shipment:", shipmentError);
              toast.error("Сделка сохранена, но ошибка создания отгрузки");
          }
      }

      toast.success('Сделка обновлена');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating deal:', error);
      toast.error('Ошибка при обновлении сделки');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать сделку</DialogTitle>
          <DialogDescription>
            Измените детали сделки и список товаров.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="timeline">История изменений</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right mt-2">Клиент</Label>
            <div className="col-span-3">
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setComboboxOpen(!comboboxOpen)}
                  className="w-full justify-between"
                >
                  {selectedCompany
                    ? companies.find((c) => c.id === selectedCompany.id)?.name
                    : deal?.companies?.name || "Выберите клиента..."}
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
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{company.name}</span>
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
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Название
            </Label>
            <Input
              id="title"
              className="col-span-3"
              required
              {...register('title', { required: true })}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Сумма (UZS)
            </Label>
            <Input
              id="amount"
              type="number"
              step="any"
              className="col-span-3"
              {...register('amount')}
              placeholder="0"
              min="0"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Статус
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('status', val)}
                defaultValue={deal?.status || 'open'}
                key={`status-${deal?.status}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🟢 Открыто</SelectItem>
                  <SelectItem value="won">✅ Выиграно</SelectItem>
                  <SelectItem value="lost">❌ Проиграно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stage_id" className="text-right">
              Этап
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('stage_id', val)}
                defaultValue={deal?.stage_id}
                key={`stage-${deal?.stage_id}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите этап" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact_id" className="text-right">
                Контакт
              </Label>
              <div className="col-span-3">
                <Select 
                  onValueChange={(val) => setValue('contact_id', val)}
                  defaultValue={deal?.contact_id || 'no_contact'}
                  key={`contact-${deal?.contact_id}`}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите контакт (опционально)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_contact">Без контакта</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Items Editor */}
          <div className="col-span-4">
             <DealItemsEditor items={dealItems} onChange={setDealItems} />
          </div>

          <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
            <Button 
                type="button" 
                variant="outline" 
                className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 mr-auto"
                onClick={handleCreateShipment}
                disabled={creatingShipment || dealItems.length === 0}
            >
                <Package className="h-4 w-4" />
                {creatingShipment ? 'Создание...' : 'Создать отгрузку'}
            </Button>

            <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Button>
            </div>
          </DialogFooter>
        </form>
      </TabsContent>

      <TabsContent value="timeline" className="h-[500px]">
        <ScrollArea className="h-full pr-4">
            {timeline.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    История изменений пуста
                </div>
            ) : (
                <div className="space-y-6 pl-2 relative border-l border-slate-200 ml-4 my-4">
                    {timeline.map((evt, i) => (
                        <div key={i} className="relative pl-6 pb-2">
                           <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 border-2 border-white" />
                           <div className="flex flex-col gap-1">
                               <span className="text-sm font-medium text-slate-900">
                                 {evt.message}
                               </span>
                               <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <User className="h-3 w-3" /> {evt.userName}
                                  <span>•</span>
                                  <Clock className="h-3 w-3" /> {new Date(evt.createdAt).toLocaleString()}
                               </div>
                           </div>
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
      </DialogContent>
    </Dialog>
  );
}