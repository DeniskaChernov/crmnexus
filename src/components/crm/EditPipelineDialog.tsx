import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
interface Pipeline {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  stages: {
    id: string;
    name: string;
    order: number;
    color: string;
  }[];
}

interface EditPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline | null;
  onPipelineUpdated?: () => void;
}

export function EditPipelineDialog({ 
  open, 
  onOpenChange, 
  pipeline, 
  onPipelineUpdated 
}: EditPipelineDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
  });

  useEffect(() => {
    if (pipeline) {
      setFormData({
        name: pipeline.name,
        description: pipeline.description || '',
        isDefault: pipeline.isDefault || false,
      });
    }
  }, [pipeline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pipeline) return;
    
    if (!formData.name.trim()) {
      toast.error('Введите название воронки');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${crmUrl(`/pipelines/${pipeline.id}`)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            isDefault: formData.isDefault,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update pipeline');
      }

      toast.success(`Воронка "${formData.name}" успешно обновлена!`);
      onOpenChange(false);
      onPipelineUpdated?.();
    } catch (error: any) {
      console.error('Error updating pipeline:', error);
      toast.error(error.message || 'Ошибка обновления воронки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Редактировать воронку</DialogTitle>
            <DialogDescription>
              Изменение настроек воронки продаж
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Название воронки *</Label>
              <Input
                id="edit-name"
                placeholder="Например: B2B Продажи, Розница, VIP Клиенты"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Описание</Label>
              <Textarea
                id="edit-description"
                placeholder="Опишите назначение воронки (опционально)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border">
              <div className="space-y-0.5">
                <Label htmlFor="edit-is-default" className="cursor-pointer">
                  Основная воронка
                </Label>
                <p className="text-sm text-muted-foreground">
                  Использовать эту воронку по умолчанию для новых сделок
                </p>
              </div>
              <Switch
                id="edit-is-default"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить изменения'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
