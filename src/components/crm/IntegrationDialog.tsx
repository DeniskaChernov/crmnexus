import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface IntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: {
    name: string;
    description: string;
    icon: React.ReactNode;
    fields?: { name: string; label: string; type: string; placeholder: string }[];
    docUrl?: string;
    // Map field names to internal credential keys (e.g. 'apiKey' -> 'apiKey')
    type?: string; 
  } | null;
  onSave?: (data: any) => Promise<void>;
}

export function IntegrationDialog({ open, onOpenChange, integration, onSave }: IntegrationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (onSave) {
        await onSave(formData);
      } else {
        // Fallback simulation
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      toast.success(`Интеграция "${integration?.name}" успешно настроена`);
      setFormData({});
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Ошибка настройки', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {integration.icon}
            {integration.name}
          </DialogTitle>
          <DialogDescription>
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {integration.fields && integration.fields.length > 0 ? (
              integration.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    required
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Эта интеграция готова к использованию без дополнительных настроек
                </p>
              </div>
            )}

            {integration.docUrl && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
                  📚 Нужна помощь с настройкой?
                </p>
                <a
                  href={integration.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Прочитайте инструкцию
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {integration.name === 'Telegram Bot' && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg space-y-2">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  Как подключить:
                </p>
                <ol className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-decimal">
                  <li>Откройте @BotFather в Telegram</li>
                  <li>Создайте нового бота командой /newbot</li>
                  <li>Скопируйте API токен</li>
                  <li>Вставьте токен в поле выше</li>
                </ol>
              </div>
            )}

            {integration.name === 'WhatsApp Business' && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg space-y-2">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Требования:
                </p>
                <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 ml-4 list-disc">
                  <li>WhatsApp Business аккаунт</li>
                  <li>Подключение через Meta Business Suite</li>
                  <li>Верифицированный номер телефона</li>
                </ul>
              </div>
            )}
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Подключение...
                </>
              ) : (
                'Подключить'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
