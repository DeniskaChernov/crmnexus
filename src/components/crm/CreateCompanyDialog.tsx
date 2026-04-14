import React, { useState } from 'react';
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
import { toast } from 'sonner@2.0.3';
import { Plus } from 'lucide-react';

interface CreateCompanyDialogProps {
  onSuccess: () => void;
}

export function CreateCompanyDialog({ onSuccess }: CreateCompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Watch select values to manually register them if needed, but setValue usually works
  
  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await crm.from('companies').insert([
        {
          name: data.name,
          phone: data.phone,
          city: data.city,
          type: data.type, // Keep this as existing 'type'
          status: data.status || 'cold', // Map our new lead status here
          notes: data.notes,
        },
      ]);

      if (error) throw error;

      toast.success('Лид успешно создан');
      setOpen(false);
      reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating lead:', error);
      toast.error('Ошибка при создании лида');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Добавить лид
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Новый лид</DialogTitle>
          <DialogDescription>
            Добавьте нового потенциального клиента.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Название / ФИО
            </Label>
            <Input
              id="name"
              className="col-span-3"
              required
              {...register('name', { required: true })}
              placeholder="ООО Компания или Иван Иванов"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Статус
            </Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('status', val)} defaultValue="cold">
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">❄️ Холодный</SelectItem>
                  <SelectItem value="warm">🔥 Тёплый</SelectItem>
                  <SelectItem value="hot">🚀 Горячий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Телефон
            </Label>
            <Input
              id="phone"
              className="col-span-3"
              {...register('phone')}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">
              Город
            </Label>
            <Input
              id="city"
              className="col-span-3"
              {...register('city')}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Тип
            </Label>
            <div className="col-span-3">
              <Select onValueChange={(val) => setValue('type', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип (опционально)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opt">Опт</SelectItem>
                  <SelectItem value="retail">Розница</SelectItem>
                  <SelectItem value="partner">Партнер</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Заметки
            </Label>
            <Textarea
              id="notes"
              className="col-span-3"
              {...register('notes')}
            />
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