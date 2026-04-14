import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Bell, Calendar, Clock, AlertCircle, CheckCircle2, X, RefreshCcw, Check, BellRing, BellOff } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner@2.0.3';
import { useNavigate } from 'react-router-dom';
import {
  requestNotificationPermission,
  showCRMNotification,
  getNotificationPermission,
  getNotificationPreference,
  setNotificationPreference,
  isNotificationSupported,
} from '../utils/pushNotifications';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  entityType?: 'deal' | 'task' | 'client' | null;
  entityId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [lastNotificationIds, setLastNotificationIds] = useState<Set<string>>(new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const navigate = useNavigate();

  // Initialize push notifications
  useEffect(() => {
    const permission = getNotificationPermission();
    const preference = getNotificationPreference();
    setPushEnabled(permission === 'granted' && preference);
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-generate notifications when panel opens
  useEffect(() => {
    if (isOpen) {
      generateNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${crmUrl('/notifications')}`,
        {
          headers: { ...authHeaders(false) }
        }
      );

      if (!response.ok) {
        setLoading(false);
        return;
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setLoading(false);
        return;
      }

      try {
        const data = await response.json();
        const newNotifications = data || [];
        
        // Check for new unread notifications and show push
        if (pushEnabled && getNotificationPreference()) {
          const currentIds = new Set(newNotifications.map((n: Notification) => n.id));
          
          newNotifications.forEach((notif: Notification) => {
            // Only show push for new unread notifications
            if (!notif.isRead && !lastNotificationIds.has(notif.id)) {
              showCRMNotification(notif);
            }
          });
          
          setLastNotificationIds(currentIds);
        }
        
        setNotifications(newNotifications);
      } catch (parseError) {
        // JSON parsing failed, silently ignore
      }
    } catch (error) {
      // Silently fail - server may be temporarily unavailable
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = async () => {
    setGenerating(true);
    try {
      const response = await fetch(
        `${crmUrl('/notifications/generate')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          }
        }
      );

      if (response.ok) {
        await fetchNotifications();
      }
      // Silently fail if server is unavailable
    } catch (error) {
      // Silently fail - server may be temporarily unavailable
    } finally {
      setGenerating(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(
        `${crmUrl(`/notifications/${id}/read`)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          }
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      const response = await fetch(
        `${crmUrl('/notifications/read-all')}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        toast.success('Все уведомления отмечены как прочитанные');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Ошибка при отметке уведомлений');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(
        `${crmUrl(`/notifications/${id}`)}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(false) }
        }
      );

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }

    if (notif.actionUrl) {
      setIsOpen(false);
      navigate(notif.actionUrl);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'info': return <Bell className="h-4 w-4 text-blue-600" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="text-xs">Срочно</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-xs">Средний</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs">Низкий</Badge>;
      default: return null;
    }
  };

  const togglePushNotifications = async () => {
    if (!isNotificationSupported()) {
      toast.error('Ваш браузер не поддерживает push-уведомления');
      return;
    }

    if (!pushEnabled) {
      // Request permission
      const permission = await requestNotificationPermission();
      
      if (permission === 'granted') {
        setNotificationPreference(true);
        setPushEnabled(true);
        toast.success('Push-уведомления включены! 🔔');
        
        // Initialize lastNotificationIds with current notifications
        setLastNotificationIds(new Set(notifications.map(n => n.id)));
        
        // Show test notification
        showCRMNotification({
          id: 'test-notification',
          type: 'success',
          title: 'Тестовое уведомление',
          message: 'Push-уведомления работают! Вы будете получать важные напоминания.',
          priority: 'medium',
        });
      } else if (permission === 'denied') {
        toast.error('Разрешите уведомления в настройках браузера');
      } else {
        toast.error('Необходимо разрешить уведомления');
      }
    } else {
      // Disable push notifications
      setNotificationPreference(false);
      setPushEnabled(false);
      toast.success('Push-уведомления отключены');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-blue-50">
          <Bell className="h-5 w-5 text-slate-600" strokeWidth={2} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-gradient-to-br from-red-500 to-pink-500 border-0 text-[10px] shadow-lg animate-pulse">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[540px] bg-white/90 backdrop-blur-xl border-l border-white/40 shadow-glass p-6">
        <SheetHeader className="border-b border-white/40 pb-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <SheetTitle className="flex items-center gap-3 text-slate-700 text-xl">
              <div className="h-10 w-10 rounded-xl bg-white/60 shadow-sm border border-white/60 flex items-center justify-center backdrop-blur-md">
                <Bell className="h-5 w-5 text-slate-600" strokeWidth={2.5} />
              </div>
              Уведомления
            </SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                disabled={isMarkingAll}
                className="h-8 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-white/50 rounded-lg transition-all"
              >
                {isMarkingAll ? (
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isMarkingAll ? 'Обновление...' : 'Прочитать все'}
              </Button>
            )}
          </div>
          <SheetDescription className="text-slate-400 font-medium ml-1">
            {unreadCount > 0 ? `${unreadCount} непрочитанных событий` : 'Все сообщения прочитаны'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-3">
            {/* Push Notifications Toggle */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {pushEnabled ? (
                      <BellRing className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <BellOff className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        Push-уведомления
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pushEnabled ? 'Включены' : 'Отключены'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={pushEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={togglePushNotifications}
                    className={pushEnabled ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    {pushEnabled ? 'Выключить' : 'Включить'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : notifications.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">Всё под контролем!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Нет активных уведомлений
                  </p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((notif) => (
                <Card 
                  key={notif.id} 
                  className={`${getTypeColor(notif.type)} border-2 transition-all ${
                    notif.actionUrl ? 'cursor-pointer hover:shadow-md' : ''
                  } ${notif.isRead ? 'opacity-60' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{notif.title}</p>
                            {!notif.isRead && (
                              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            )}
                            {getPriorityBadge(notif.priority)}
                          </div>
                          <p className="text-sm opacity-90">{notif.message}</p>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <Calendar className="h-3 w-3" />
                            {new Date(notif.createdAt).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}