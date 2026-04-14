import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
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
import { Textarea } from '../ui/textarea';
import { Mail, Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

interface EmailTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export function EmailTemplatesDialog({ open, onOpenChange, onSelectTemplate }: EmailTemplatesDialogProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'sales',
  });

  const defaultTemplates: EmailTemplate[] = [
    {
      id: 'default-1',
      name: 'Первый контакт',
      subject: 'Знакомство - {company_name}',
      body: `Здравствуйте!

Меня зовут {your_name}, я представляю {your_company}.

Я заметил, что ваша компания {company_name} работает в сфере {industry}. Мы специализируемся на [ваше предложение].

Хотел бы обсудить возможности сотрудничества. Может быть удобно встретиться на следующей неделе?

С уважением,
{your_name}
{your_position}`,
      category: 'sales'
    },
    {
      id: 'default-2',
      name: 'Followup после встречи',
      subject: 'Спасибо за встречу - {company_name}',
      body: `Здравствуйте!

Спасибо за уделенное время и продуктивную встречу.

Как мы обсуждали, вышлю вам коммерческое предложение до {deadline}. 

Основные моменты нашей встречи:
• [Пункт 1]
• [Пункт 2]
• [Пункт 3]

Если возникнут вопросы - всегда на связи!

С уважением,
{your_name}`,
      category: 'followup'
    },
    {
      id: 'default-3',
      name: 'Коммерческое предложение',
      subject: 'Коммерческое предложение - {company_name}',
      body: `Здравствуйте!

Направляю коммерческое предложение для {company_name}.

Основные преимущества нашего решения:
✓ [Преимущество 1]
✓ [Преимущество 2]
✓ [Преимущество 3]

Стоимость: {amount} UZS

Предложение действительно до {deadline}.

Готов ответить на все вопросы!

С уважением,
{your_name}`,
      category: 'proposal'
    },
    {
      id: 'default-4',
      name: 'Напоминание',
      subject: 'Напоминание о нашем предложении',
      body: `Здравствуйте!

Хотел напомнить о нашем предложении от {date}.

Есть ли у вас вопросы? Готов их обсудить.

Если удобно, можем созвониться сегодня или завтра.

С уважением,
{your_name}`,
      category: 'followup'
    }
  ];

  useEffect(() => {
    if (open) {
      loadUserAndTemplates();
    }
  }, [open]);

  const loadUserAndTemplates = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await crm.auth.getSession();
      if (!session?.user) {
        console.error('No user session found');
        setLoading(false);
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);

      // Load templates from kv_store
      const response = await fetch(
        `${crmUrl(`/email-templates?userId=${currentUserId}`)}`,
        {
          method: 'GET',
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
        } else {
          // Set default templates if none exist
          setTemplates(defaultTemplates);
        }
      } else {
        setTemplates(defaultTemplates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplates = async (updatedTemplates: EmailTemplate[]) => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${crmUrl('/email-templates')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({
            userId,
            templates: updatedTemplates
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save templates');
      }

      setTemplates(updatedTemplates);
      toast.success('Шаблон сохранён');
    } catch (error: any) {
      console.error('Save templates error:', error);
      toast.error('Не удалось сохранить шаблон');
    }
  };

  const handleSaveTemplate = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error('Заполните все поля');
      return;
    }

    const newTemplate: EmailTemplate = {
      id: editingTemplate?.id || `custom-${Date.now()}`,
      name: formData.name,
      subject: formData.subject,
      body: formData.body,
      category: formData.category
    };

    let updatedTemplates;
    if (editingTemplate) {
      updatedTemplates = templates.map(t => t.id === editingTemplate.id ? newTemplate : t);
    } else {
      updatedTemplates = [...templates, newTemplate];
    }

    await saveTemplates(updatedTemplates);
    
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({ name: '', subject: '', body: '', category: 'sales' });
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category
    });
    setShowForm(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (id.startsWith('default-')) {
      toast.error('Нельзя удалить стандартный шаблон');
      return;
    }

    const updatedTemplates = templates.filter(t => t.id !== id);
    await saveTemplates(updatedTemplates);
    toast.success('Шаблон удалён');
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      onOpenChange(false);
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(`Тема: ${template.subject}\n\n${template.body}`);
      toast.success('Шаблон скопирован в буфер обмена');
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'sales': return 'Продажи';
      case 'followup': return 'Followup';
      case 'proposal': return 'КП';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sales': return 'bg-blue-100 text-blue-800';
      case 'followup': return 'bg-green-100 text-green-800';
      case 'proposal': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email шаблоны
          </DialogTitle>
          <DialogDescription>
            Готовые шаблоны писем для быстрой отправки
          </DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <>
            <div className="px-6 py-3 border-b">
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Создать шаблон
              </Button>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
              <div className="grid gap-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Нет сохранённых шаблонов
                  </div>
                ) : (
                  templates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.name}
                              <Badge className={`${getCategoryColor(template.category)}`}>
                                {getCategoryLabel(template.category)}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">
                              <strong>Тема:</strong> {template.subject}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            {!template.id.startsWith('default-') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditTemplate(template)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border max-h-32 overflow-y-auto">
                          {template.body}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => handleUseTemplate(template)}>
                            {onSelectTemplate ? 'Использовать' : 'Скопировать'}
                            {!onSelectTemplate && <Copy className="h-3 w-3 ml-2" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Название шаблона</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: Первый контакт"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-category">Категория</Label>
                  <select
                    id="template-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="sales">Продажи</option>
                    <option value="followup">Followup</option>
                    <option value="proposal">Коммерческое предложение</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-subject">Тема письма</Label>
                  <Input
                    id="template-subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Например: Знакомство - {company_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Доступные переменные: {'{company_name}'}, {'{your_name}'}, {'{amount}'}, {'{date}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-body">Текст письма</Label>
                  <Textarea
                    id="template-body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Введите текст шаблона..."
                    rows={12}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="px-6 py-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingTemplate(null);
                  setFormData({ name: '', subject: '', body: '', category: 'sales' });
                }}
              >
                Отмена
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate ? 'Сохранить изменения' : 'Создать шаблон'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
