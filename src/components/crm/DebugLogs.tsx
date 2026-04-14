import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { RefreshCw, Bug, Link, ExternalLink, AlertCircle, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner@2.0.3';

export function DebugLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [expectedUrl, setExpectedUrl] = useState<string>("");
  const [envCheck, setEnvCheck] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${crmUrl('/debug/logs')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        
        const info = data.webhookInfo || {};
        if (data.expectedUrlMasked) {
             info.expectedUrlMasked = data.expectedUrlMasked;
        }
        setWebhookInfo(info);
        setExpectedUrl(data.expectedUrl);
        setEnvCheck(data.envCheck);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLoading(false);
    }
  };

  const fixWebhook = async () => {
    setFixing(true);
    try {
        const response = await fetch(`${crmUrl('/debug/fix-webhook')}`, {
            method: 'POST',
            headers: { ...authHeaders(false) }
        });
        const data = await response.json();
        
        if (response.ok && data.ok) {
            toast.success("Webhook URL обновлен успешно");
            fetchLogs();
        } else {
            toast.error(data.error || "Ошибка обновления Webhook");
        }
    } catch (e: any) {
        toast.error("Ошибка соединения: " + e.message);
    } finally {
        setFixing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const hasApiKeyInUrl = webhookInfo?.url && webhookInfo.url.includes('apikey=');
  const is401Error = webhookInfo?.last_error_message && webhookInfo.last_error_message.includes('401');

  return (
    <div className="space-y-4">
        {/* Webhook Status Card */}
        {webhookInfo && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900">
                <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-base">Статус Webhook (Telegram API)</CardTitle>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={fixWebhook} 
                            disabled={fixing}
                            className="h-7 text-xs bg-white"
                        >
                            <Wrench className={`h-3 w-3 mr-1 ${fixing ? 'animate-spin' : ''}`} />
                            Исправить URL
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                    {envCheck && !envCheck.hasAnonKey && (
                        <div className="bg-red-100 text-red-900 p-3 rounded-md border border-red-200 mb-2">
                             <div className="font-bold flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Ошибка конфигурации
                             </div>
                             <p className="mt-1">
                                На сервере не заданы нужные переменные окружения (например <code className="px-1 bg-white/60 rounded">JWT_SECRET</code>, <code className="px-1 bg-white/60 rounded">PUBLIC_BASE_URL</code>). Проверьте деплой на Railway.
                             </p>
                        </div>
                    )}

                    <div className="grid grid-cols-[120px_1fr] gap-2 items-center border-b border-blue-200/50 pb-2">
                        <span className="text-muted-foreground">Текущий URL:</span>
                        <div className="flex flex-col gap-1">
                             <code className="font-mono text-xs bg-white/50 px-2 py-1 rounded break-all" title={webhookInfo.url}>
                                {webhookInfo.url ? (
                                    <>
                                        ...{webhookInfo.url.substring(webhookInfo.url.length - 60)}
                                    </>
                                ) : "Не задан"}
                            </code>
                            {hasApiKeyInUrl && (
                                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                                    ✓ API ключ присутствует в URL
                                </span>
                            )}
                            {!hasApiKeyInUrl && webhookInfo.url && (
                                <span className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                                    ⚠ API ключ отсутствует в URL
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                        <span className="text-muted-foreground">Состояние:</span>
                        <div className="flex items-center gap-2">
                            {hasApiKeyInUrl ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                    URL корректен
                                </Badge>
                            ) : (
                                <Badge variant="destructive">
                                    Требует исправления
                                </Badge>
                            )}
                            {webhookInfo.pending_update_count > 0 && (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                    В очереди: {webhookInfo.pending_update_count}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Critical 401 Error Help Block */}
                    {is401Error && (
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-5 mt-4 space-y-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-6 w-6 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-orange-900 text-lg">⚠️ Ошибка 401 при обращении к API</h4>
                                    <p className="text-sm text-orange-800 mt-2 leading-relaxed">
                                        Telegram или внешний клиент получает отказ авторизации. Убедитесь, что URL вебхука указывает на ваш сервис с префиксом <code className="text-xs bg-orange-100 px-1 rounded">/make-server-f9553289</code>, а для публичных маршрутов (например Telegram) на сервере настроены исключения JWT.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur rounded-lg border-2 border-orange-200 p-4 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                                    <p className="font-semibold text-gray-900">Откройте Railway (или хостинг API)</p>
                                </div>
                                <p className="text-sm text-gray-700 ml-8">
                                    Проверьте переменные <code className="bg-orange-100 px-2 py-0.5 rounded text-xs">PUBLIC_BASE_URL</code>, <code className="bg-orange-100 px-2 py-0.5 rounded text-xs">JWT_SECRET</code>, логи сервиса <code className="bg-orange-100 px-2 py-0.5 rounded text-xs">npm run server</code>.
                                </p>

                                <div className="flex items-center gap-2 mb-2 mt-4">
                                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                                    <p className="font-semibold text-gray-900">Публичные маршруты</p>
                                </div>
                                <p className="text-sm text-gray-700 ml-8">
                                    Убедитесь, что маршрут Telegram webhook в коде API помечен как публичный (без обязательного Bearer), если Bot API обращается без токена пользователя.
                                </p>

                                <div className="flex items-center gap-2 mb-2 mt-4">
                                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                                    <p className="font-semibold text-gray-900">Обновите webhook</p>
                                </div>
                                <p className="text-sm text-gray-700 ml-8">
                                    Нажмите кнопку <strong>«Исправить Webhook»</strong> ниже после правок URL в BotFather / на сервере.
                                </p>
                            </div>

                            <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Локально</p>
                                <code className="block text-sm text-green-400 font-mono">
                                    npm run server
                                </code>
                                <p className="text-xs text-slate-400 mt-2">
                                    В корне проекта задайте <code className="bg-slate-800 px-1 rounded">.env</code> по образцу <code className="bg-slate-800 px-1 rounded">.env.example</code>.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    onClick={fixWebhook}
                                    disabled={fixing}
                                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold shadow-md"
                                    size="sm"
                                >
                                    <Wrench className={`h-4 w-4 mr-2 ${fixing ? 'animate-spin' : ''}`} />
                                    {fixing ? 'Применение...' : '3️⃣ Исправить Webhook после настройки'}
                                </Button>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <p className="text-xs text-blue-800">
                                    <strong>Webhook URL:</strong> <code className="bg-blue-100 px-2 py-0.5 rounded ml-1 break-all">{expectedUrl}</code>
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

        {/* Logs Card */}
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900">
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-yellow-600" />
                <CardTitle>История запросов</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
            </Button>
            </div>
            <CardDescription>
            Последние 50 входящих запросов. Напишите боту <code>/ping</code> для проверки.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[300px] rounded-md border bg-white dark:bg-black p-4">
            {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <p>Нет данных о запросах</p>
                <p className="text-xs text-center max-w-[200px]">
                    Если вы пишете боту, а здесь пусто — проверьте статус Webhook выше.
                </p>
                </div>
            ) : (
                <div className="space-y-4">
                {logs.map((log: any) => (
                    <div key={log.id} className="flex flex-col gap-1 border-b pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{log.sender}</span>
                        <span className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), 'dd.MM HH:mm:ss')}
                        </span>
                    </div>
                    <div className="text-sm bg-slate-100 dark:bg-slate-900 p-2 rounded mt-1 font-mono break-all">
                        {log.message.substring(0, 200)}
                        {log.message.length > 200 && '...'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant={log.status === 'success' ? 'default' : log.status === 'ignored' ? 'secondary' : 'destructive'} className="text-xs">
                            {log.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.reason}</span>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    )}
                    </div>
                ))}
                </div>
            )}
            </ScrollArea>
        </CardContent>
        </Card>
    </div>
  );
}