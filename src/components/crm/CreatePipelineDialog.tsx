import React, { useState } from 'react';
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
interface CreatePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePipelineDialog({ open, onOpenChange, onSuccess }: CreatePipelineDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Введите название воронки');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${crmUrl('/pipelines')}`,
        {
          method: 'POST',
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
        throw new Error(error.error || 'Failed to create pipeline');
      }

      const result = await response.json();
      toast.success(`Воронка "${formData.name}" успешно создана!`);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        isDefault: false,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating pipeline:', error);
      toast.error(error.message || 'Ошибка создания воронки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Создать новую воронку</DialogTitle>
            <DialogDescription>
              Создайте дополнительную воронку продаж для разных типов сделок
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название воронки *</Label>
              <Input
                id="name"
                placeholder="Например: B2B Продажи, Розница, VIP Клиенты"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Опишите назначение воронки (опционально)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border">
              <div className="space-y-0.5">
                <Label htmlFor="is-default" className="cursor-pointer">
                  Основная воронка
                </Label>
                <p className="text-sm text-muted-foreground">
                  Использовать эту воронку по умолчанию для новых сделок
                </p>
              </div>
              <Switch
                id="is-default"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                disabled={loading}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 <strong>Совет:</strong> После создания воронки вы сможете настроить её этапы на странице "Воронки"
              </p>
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
                  Создание...
                </>
              ) : (
                'Создать воронку'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
