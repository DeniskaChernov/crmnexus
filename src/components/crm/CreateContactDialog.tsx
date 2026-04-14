
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
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner@2.0.3';
import { Plus } from 'lucide-react';

interface CreateContactDialogProps {
  onSuccess: () => void;
}

export function CreateContactDialog({ onSuccess }: CreateContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    if (open) {
      fetchCompanies();
    }
  }, [open]);

  const fetchCompanies = async () => {
    const { data } = await crm.from('companies').select('id, name').order('name');
    setCompanies(data || []);
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await crm.from('contacts').insert([
        {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          position: data.position,
          company_id: data.company_id,
        },
      ]);

      if (error) throw error;

      toast.success('Контакт успешно создан');
      setOpen(false);
      reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error('Ошибка при создании контакта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Добавить контакт
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
          <DialogDescription>
            Добавьте контактное лицо.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="first_name" className="text-right">Имя</Label>
            <Input id="first_name" className="col-span-3" required {...register('first_name', { required: true })} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="last_name" className="text-right">Фамилия</Label>
            <Input id="last_name" className="col-span-3" {...register('last_name')} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="company" className="text-right">Компания</Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('company_id', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите компанию" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" className="col-span-3" {...register('email')} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">Телефон</Label>
            <Input id="phone" className="col-span-3" {...register('phone')} />
          </div>
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
