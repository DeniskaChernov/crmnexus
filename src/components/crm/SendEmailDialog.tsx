import React, { useState } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Mail, Send, FileText } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { EmailTemplatesDialog } from './EmailTemplatesDialog';

interface SendEmailDialogProps {
  recipientEmail?: string;
  recipientName?: string;
  dealTitle?: string;
  trigger?: React.ReactNode;
}

export function SendEmailDialog({ 
  recipientEmail = '', 
  recipientName = '',
  dealTitle,
  trigger 
}: SendEmailDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    to: recipientEmail,
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.to || !formData.subject || !formData.message) {
      toast.error('Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${crmUrl('/send-email')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({
            to: formData.to,
            subject: formData.subject,
            message: formData.message,
            dealTitle,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.hint) {
          toast.error(data.error, {
            description: data.hint,
            duration: 5000,
          });
        } else {
          throw new Error(data.error || 'Failed to send email');
        }
        return;
      }

      toast.success('Email успешно отправлен');
      setFormData({ to: recipientEmail, subject: '', message: '' });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Ошибка отправки email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Отправить email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Отправить email
          </DialogTitle>
          <DialogDescription>
            {recipientName || recipientEmail ? (
              <>
                {recipientName && `Отправить письмо контакту: ${recipientName}`}
                {dealTitle && ` по сделке "${dealTitle}"`}
                {!recipientName && !dealTitle && `Отправка письма на ${recipientEmail}`}
              </>
            ) : (
              'Отправьте email письмо вашему клиенту'
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">Email получателя</Label>
            <Input
              id="to"
              type="email"
              placeholder="example@email.com"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Тема письма</Label>
            <Input
              id="subject"
              placeholder="Коммерческое предложение"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Сообщение</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setTemplatesOpen(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Использовать шаблон
              </Button>
            </div>
            <Textarea
              id="message"
              placeholder="Здравствуйте,&#10;&#10;Направляю вам коммерческое предложение..."
              rows={8}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </form>
        
        <EmailTemplatesDialog 
          open={templatesOpen} 
          onOpenChange={setTemplatesOpen}
          onSelectTemplate={(template) => {
            setFormData({
              ...formData,
              subject: template.subject,
              message: template.body
            });
            setTemplatesOpen(false);
            toast.success('Шаблон применён');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}