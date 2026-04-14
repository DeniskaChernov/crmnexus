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

interface EditCompanyDialogProps {
  company: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCompanyDialog({ company, open, onOpenChange, onSuccess }: EditCompanyDialogProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    if (company && open) {
      setValue('name', company.name);
      setValue('phone', company.phone);
      setValue('city', company.city);
      setValue('type', company.type);
      setValue('status', company.status);
      setValue('notes', company.notes);
    }
  }, [company, open, setValue]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await crm
        .from('companies')
        .update({
          name: data.name,
          phone: data.phone,
          city: data.city,
          type: data.type,
          status: data.status,
          notes: data.notes,
        })
        .eq('id', company.id);

      if (error) throw error;

      toast.success('Лид обновлен');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating lead:', error);
      toast.error('Ошибка при обновлении лида');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактировать лид</DialogTitle>
          <DialogDescription>
            Измените информацию о лиде или поменяйте его статус.
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
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Статус
            </Label>
            <div className="col-span-3">
              <Select 
                onValueChange={(val) => setValue('status', val)} 
                defaultValue={company?.status}
                key={company?.status} // Force re-render when company changes
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">❄️ Холодный</SelectItem>
                  <SelectItem value="warm">🔥 Тёплый</SelectItem>
                  <SelectItem value="hot">🚀 Горячий</SelectItem>
                  <SelectItem value="new">Новый</SelectItem>
                  <SelectItem value="active">Активный</SelectItem>
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
              <Select 
                onValueChange={(val) => setValue('type', val)}
                defaultValue={company?.type}
                key={`type-${company?.type}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
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
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}