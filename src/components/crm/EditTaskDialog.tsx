import React, { useEffect, useState } from 'react';
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
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner@2.0.3';

interface EditTaskDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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

export function EditTaskDialog({ task, open, onOpenChange, onSuccess }: EditTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    if (task && open) {
      loadDealsAndContacts();
      setValue('title', task.title);
      setValue('description', task.description);
      setValue('type', task.type);
      setValue('priority', task.priority);
      setValue('deal_id', task.deal_id || 'none');
      setValue('contact_id', task.contact_id || 'none');
      // Format date for input[type="date"]
      if (task.due_date) {
        const date = new Date(task.due_date);
        const formatted = date.toISOString().split('T')[0];
        setValue('due_date', formatted);
      }
    }
  }, [task, open, setValue]);

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
    try {
      const { error } = await crm
        .from('tasks')
        .update({
          title: data.title,
          description: data.description,
          type: data.type,
          due_date: data.due_date ? `${data.due_date}T12:00:00Z` : null,
          priority: data.priority,
          deal_id: data.deal_id === 'none' ? null : data.deal_id,
          contact_id: data.contact_id === 'none' ? null : data.contact_id,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Задача обновлена');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Ошибка при обновлении задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактировать задачу</DialogTitle>
          <DialogDescription>
            Измените детали задачи.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            <Label htmlFor="description" className="text-right">
              Описание
            </Label>
            <Textarea
              id="description"
              className="col-span-3"
              {...register('description')}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Тип
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('type', val)} 
                defaultValue={task?.type}
                key={`type-${task?.type}`}
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
            <Label htmlFor="due_date" className="text-right">
              Срок
            </Label>
            <Input
              id="due_date"
              type="date"
              className="col-span-3"
              {...register('due_date')}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Приоритет
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('priority', val)}
                defaultValue={task?.priority}
                key={`priority-${task?.priority}`}
              >
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

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deal_id" className="text-right">
              Сделка
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('deal_id', val)}
                defaultValue={task?.deal_id || 'none'}
                key={`deal-${task?.deal_id}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сделку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contact_id" className="text-right">
              Контакт
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('contact_id', val)}
                defaultValue={task?.contact_id || 'none'}
                key={`contact-${task?.contact_id}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите контакт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет</SelectItem>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
