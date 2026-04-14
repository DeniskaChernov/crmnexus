import React, { useState, useEffect } from 'react';
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
import { Pencil, Loader2 } from 'lucide-react';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  onSuccess: () => void;
}

export function EditContactDialog({ open, onOpenChange, contact, onSuccess }: EditContactDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    if (open && contact) {
      fetchCompanies();
      // Заполняем форму текущими данными
      setValue('first_name', contact.first_name);
      setValue('last_name', contact.last_name);
      setValue('email', contact.email || '');
      setValue('phone', contact.phone || '');
      setValue('position', contact.position || '');
      setValue('company_id', contact.company_id || '');
    }
  }, [open, contact]);

  const fetchCompanies = async () => {
    const { data } = await crm.from('companies').select('id, name').order('name');
    setCompanies(data || []);
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await crm
        .from('contacts')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          position: data.position,
          company_id: data.company_id || null,
        })
        .eq('id', contact.id);

      if (error) throw error;

      toast.success('Контакт обновлён');
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Error updating contact:', err);
      toast.error('Ошибка при обновлении контакта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Редактировать контакт
          </DialogTitle>
          <DialogDescription>
            Изменение информации о контактном лице
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя *</Label>
                <Input id="first_name" {...register('first_name', { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия *</Label>
                <Input id="last_name" {...register('last_name', { required: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" type="tel" {...register('phone')} placeholder="+998 90 123 45 67" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Input id="position" {...register('position')} placeholder="Генеральный директор" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_id">Компания</Label>
              <Select onValueChange={(value) => setValue('company_id', value)} defaultValue={contact?.company_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите компанию" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
