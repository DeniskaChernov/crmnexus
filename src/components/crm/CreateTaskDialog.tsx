import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from 'sonner@2.0.3';
import { Plus } from 'lucide-react';

interface CreateTaskDialogProps {
  onSuccess: () => void;
  prefilledDealId?: string;
  prefilledContactId?: string;
  triggerButton?: React.ReactNode;
}

interface Deal {
  id: string;
  title: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
}

export function CreateTaskDialog({ onSuccess, prefilledDealId, prefilledContactId, triggerButton }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [category, setCategory] = useState<'client' | 'employee'>('client');
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  
  const selectedType = watch('type');

  useEffect(() => {
    if (open) {
      loadDealsAndContacts();
      if (prefilledDealId) {
        setValue('deal_id', prefilledDealId);
        setCategory('client');
      }
      if (prefilledContactId) {
        setValue('contact_id', prefilledContactId);
        setCategory('client');
      }
    }
  }, [open, prefilledDealId, prefilledContactId]);

  const loadDealsAndContacts = async () => {
    setLoadingData(true);
    try {
      // Load active deals
      const { data: dealsData } = await crm
        .from('deals')
        .select('id, title')
        .eq('status', 'open')
        .order('title');
      
      // Load contacts
      const { data: contactsData } = await crm
        .from('contacts')
        .select('id, first_name, last_name')
        .order('first_name');
      
      setDeals(dealsData || []);
      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error loading deals and contacts:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    
    // Validation for client category
    if (category === 'client' && data.type === 'task' && (!data.deal_id || data.deal_id === 'none') && (!data.contact_id || data.contact_id === 'none')) {
      toast.error('Для задачи типа "Действие с клиентом" необходимо выбрать Сделку или Контакт, либо изменить тип на Звонок/Встреча/Email');
      setLoading(false);
      return;
    }

    try {
      const { error } = await crm.from('tasks').insert([
        {
          title: data.title,
          description: data.description,
          due_date: data.due_date ? `${data.due_date}T12:00:00Z` : null,
          priority: data.priority || 'medium',
          status: 'planned',
          type: category === 'employee' ? 'task' : (data.type || 'task'),
          deal_id: (category === 'client' && data.deal_id !== 'none') ? data.deal_id : null,
          contact_id: (category === 'client' && data.contact_id !== 'none') ? data.contact_id : null,
        },
      ]);

      if (error) throw error;

      toast.success('Задача создана');
      setOpen(false);
      reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error('Ошибка при создании задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Новая задача
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
          <DialogDescription>
            Запланируйте действие и привяжите к сделке или контакту.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Категория</Label>
            <div className="col-span-3">
              <RadioGroup 
                value={category} 
                onValueChange={(val: 'client' | 'employee') => {
                  setCategory(val);
                  if (val === 'employee') {
                    setValue('type', 'task');
                    setValue('deal_id', 'none');
                    setValue('contact_id', 'none');
                  } else {
                    // Reset to default task type if needed
                    if (selectedType === 'task') setValue('type', 'call'); // Suggest call for client action if it was task
                  }
                }}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="r-client" />
                  <Label htmlFor="r-client" className="cursor-pointer font-normal">Действия с клиентом</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="employee" id="r-employee" />
                  <Label htmlFor="r-employee" className="cursor-pointer font-normal">Задачи сотрудников</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Название</Label>
            <Input id="title" className="col-span-3" required {...register('title', { required: true })} placeholder="Например: Позвонить клиенту" />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Описание</Label>
            <Textarea 
              id="description" 
              className="col-span-3" 
              {...register('description')} 
              placeholder="Дополнительная информация"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Тип</Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('type', val)} 
                defaultValue="task"
                value={category === 'employee' ? 'task' : undefined}
                disabled={category === 'employee'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Звонок</SelectItem>
                  <SelectItem value="meeting">👥 Встреча</SelectItem>
                  <SelectItem value="email">✉️ Email</SelectItem>
                  <SelectItem value="task">✓ Задача</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="due_date" className="text-right">Срок</Label>
            <Input id="due_date" type="date" className="col-span-3" {...register('due_date')} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">Приоритет</Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('priority', val)} defaultValue="medium">
                <SelectTrigger>
                  <SelectValue placeholder="Приоритет" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Низкий</SelectItem>
                  <SelectItem value="medium">🟡 Средний</SelectItem>
                  <SelectItem value="high">🔴 Высокий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {category === 'client' && (
            <div className="border-t pt-4 space-y-4 bg-slate-50/50 -mx-6 px-6 pb-4 mt-4">
              <p className="text-sm font-medium text-slate-700">Привязка к клиенту:</p>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deal_id" className="text-right">Сделка</Label>
                <div className="col-span-3">
                  <Select 
                    onValueChange={(val) => setValue('deal_id', val === 'none' ? null : val)} 
                    defaultValue={prefilledDealId || 'none'}
                    disabled={loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сделку" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без сделки</SelectItem>
                      {deals.map(deal => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contact_id" className="text-right">Контакт</Label>
                <div className="col-span-3">
                  <Select 
                    onValueChange={(val) => setValue('contact_id', val === 'none' ? null : val)}
                    defaultValue={prefilledContactId || 'none'}
                    disabled={loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите контакт" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без контакта</SelectItem>
                      {contacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}