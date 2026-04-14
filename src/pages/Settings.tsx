import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import {
  Building2,
  Users,
  Workflow,
  Bell,
  Shield,
  Mail,
  Smartphone,
  Globe,
  Save,
  Plug,
  Database,
  Trash2,
  Loader2,
  Star,
  Edit,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { AddUserDialogButton } from '../components/crm/AddUserDialogButton';
import { IntegrationDialog } from '../components/crm/IntegrationDialog';
import { EditUserDialog } from '../components/crm/EditUserDialog';
import { UserDetailDialog } from '../components/crm/UserDetailDialog';
import { CreatePipelineDialog } from '../components/crm/CreatePipelineDialog';
import { EditPipelineDialog } from '../components/crm/EditPipelineDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { crm } from "@/lib/crmClient.ts";
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

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

import { DebugLogs } from '../components/crm/DebugLogs';

export default function Settings() {
  const [companyName, setCompanyName] = useState('Моя Компания');
  const [companyEmail, setCompanyEmail] = useState('info@company.uz');
  const [companyPhone, setCompanyPhone] = useState('+998 90 123 45 67');
  const [companyWebsite, setCompanyWebsite] = useState('www.company.uz');
  const [savingCompany, setSavingCompany] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(true);
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [dealNotifications, setDealNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [currency, setCurrency] = useState('UZS');
  const [timezone, setTimezone] = useState('Asia/Tashkent');
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [savingRegional, setSavingRegional] = useState(false);

  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetailDialogOpen, setUserDetailDialogOpen] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [createPipelineDialogOpen, setCreatePipelineDialogOpen] = useState(false);
  const [editPipelineDialogOpen, setEditPipelineDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deletePipelineDialogOpen, setDeletePipelineDialogOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<Pipeline | null>(null);
  const [deletingPipeline, setDeletingPipeline] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Automation Settings State
  const [autoCreateTasks, setAutoCreateTasks] = useState(false);
  const [stalledNotifications, setStalledNotifications] = useState(false);
  const [emailOnWin, setEmailOnWin] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);

  const handleResetDatabase = async () => {
    if (!confirm('ВЫ УВЕРЕНЫ? Это удалит ВСЕ сделки, клиентов и контакты. Действие необратимо!')) return;
    if (!confirm('Подтвердите удаление. Вы действительно хотите очистить базу данных?')) return;

    setResetting(true);
    try {
      // Delete deals
      const { error: dealsError } = await crm.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (dealsError) throw dealsError;

      // Delete contacts
      const { error: contactsError } = await crm.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (contactsError) throw contactsError;

      // Delete companies
      const { error: companiesError } = await crm.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (companiesError) throw companiesError;

      toast.success('База данных успешно очищена');
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error('Ошибка при очистке базы: ' + error.message);
    } finally {
      setResetting(false);
    }
  };

  const [integrationsStatus, setIntegrationsStatus] = useState({ google: false, telegram: false, resend: false });

  const fetchIntegrations = async () => {
    try {
      const response = await fetch(`${crmUrl('/integrations/status')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setIntegrationsStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch integrations", e);
    }
  };

  const handleSaveIntegration = async (data: any) => {
    if (!selectedIntegration?.type) return;
    
    const response = await fetch(`${crmUrl('/integrations')}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        type: selectedIntegration.type,
        credentials: data
      })
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save integration");
    }
    
    await fetchIntegrations();
  };

  const handleDisconnectIntegration = async (type: string) => {
    if (!confirm("Вы уверены? Это удалит сохраненные ключи.")) return;
    
    try {
        const response = await fetch(`${crmUrl(`/integrations/${type}`)}`, {
          method: 'DELETE',
          headers: { ...authHeaders(false) }
        });
        
        if (response.ok) {
            toast.success("Интеграция отключена");
            setIntegrationsStatus(prev => ({ ...prev, [type]: false }));
        } else {
            toast.error("Ошибка при отключении");
        }
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при отключении");
    }
  };

  const openIntegrationDialog = (integration: any) => {
    setSelectedIntegration(integration);
    setIntegrationDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const response = await fetch(
        `${crmUrl('/company')}`,
        {
          method: 'POST',
          headers: { ...authHeaders() },
          body: JSON.stringify({
            name: companyName,
            email: companyEmail,
            phone: companyPhone,
            website: companyWebsite,
          }),
        }
      );

      if (response.ok) {
        toast.success('Данные компании сохранены');
      } else {
        throw new Error('Ошибка при сохранении данных компании');
      }
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Не удалось сохранить данные компании');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const response = await fetch(`${crmUrl('/notifications/settings')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          email: emailNotifications,
          push: pushNotifications,
          deals: dealNotifications,
          tasks: taskNotifications
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      toast.success('Настройки уведомлений сохранены');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при сохранении настроек');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveRegional = async () => {
    setSavingRegional(true);
    try {
      const response = await fetch(`${crmUrl('/regional-settings')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          currency,
          timezone,
          dateFormat
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      toast.success('Региональные настройки сохранены');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при сохранении настроек');
    } finally {
      setSavingRegional(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const response = await fetch(`${crmUrl('/notifications/settings')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setEmailNotifications(data.email ?? true);
        setPushNotifications(data.push ?? true);
        setDealNotifications(data.deals ?? true);
        setTaskNotifications(data.tasks ?? true);
      }
    } catch (e) {
      console.error("Failed to fetch notification settings", e);
    }
  };

  const fetchRegionalSettings = async () => {
    try {
      const response = await fetch(`${crmUrl('/regional-settings')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrency(data.currency || 'UZS');
        setTimezone(data.timezone || 'Asia/Tashkent');
        setDateFormat(data.dateFormat || 'DD.MM.YYYY');
      }
    } catch (e) {
      console.error("Failed to fetch regional settings", e);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch(
        `${crmUrl('/users')}`,
        {
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserDialogOpen(true);
  };

  const handleUserClick = (user: User) => {
    setSelectedUserForDetail(user);
    setUserDetailDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const response = await fetch(
        `${crmUrl(`/users/${userToDelete.id}`)}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(false) },
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при удалении пользователя');
      }

      toast.success('Пользователь удалён');
      fetchUsers();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Не удалось удалить пользователя');
    } finally {
      setDeletingUser(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return '👑 Владелец';
      case 'manager':
        return '⭐ Менеджер';
      case 'observer':
        return '👁️ Наблюдатель';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'manager':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'observer':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  const fetchPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const response = await fetch(
        `${crmUrl('/pipelines')}`,
        {
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPipelines(data);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const fetchCompany = async () => {
    setLoadingCompany(true);
    try {
      const response = await fetch(
        `${crmUrl('/company')}`,
        {
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setCompanyName(data.name || 'Моя Компания');
          setCompanyEmail(data.email || 'info@company.uz');
          setCompanyPhone(data.phone || '+998 90 123 45 67');
          setCompanyWebsite(data.website || 'www.company.uz');
        }
      }
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoadingCompany(false);
    }
  };

  const fetchAutomationSettings = async () => {
    try {
      const response = await fetch(`${crmUrl('/automation/settings')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setAutoCreateTasks(data.autoCreateTasks ?? false);
        setStalledNotifications(data.stalledNotifications ?? false);
        setEmailOnWin(data.emailOnWin ?? false);
      }
    } catch (e) {
      console.error("Failed to fetch automation settings", e);
    }
  };

  useEffect(() => {
    fetchPipelines();
    fetchCompany();
    fetchIntegrations();
    fetchNotificationSettings();
    fetchRegionalSettings();
    fetchAutomationSettings();
  }, []);

  const handleSaveAutomation = async () => {
    setSavingAutomation(true);
    try {
      const response = await fetch(`${crmUrl('/automation/settings')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          autoCreateTasks,
          stalledNotifications,
          emailOnWin
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      toast.success('Настройки автоматизации сохранены');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при сохранении настроек');
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setEditPipelineDialogOpen(true);
  };

  const handleCreatePipeline = () => {
    setCreatePipelineDialogOpen(true);
  };

  const handleDeletePipeline = (pipeline: Pipeline) => {
    setPipelineToDelete(pipeline);
    setDeletePipelineDialogOpen(true);
  };

  const handleDeletePipelineConfirm = async () => {
    if (!pipelineToDelete) return;

    setDeletingPipeline(true);
    try {
      const response = await fetch(
        `${crmUrl(`/pipelines/${pipelineToDelete.id}`)}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(false) },
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при удалении воронки');
      }

      toast.success('Воронка удалена');
      fetchPipelines();
      setDeletePipelineDialogOpen(false);
      setPipelineToDelete(null);
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast.error('Не удалось удалить воронку');
    } finally {
      setDeletingPipeline(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Настройки</h2>
        <p className="text-muted-foreground mt-2">
          Управление системой и настройка параметров CRM
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="w-full flex justify-start md:grid md:grid-cols-7 overflow-x-auto h-auto no-scrollbar p-1">
          <TabsTrigger value="company" className="gap-2 min-w-[110px] flex-shrink-0">
            <Building2 className="h-4 w-4" />
            <span className="inline">Компания</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 min-w-[130px] flex-shrink-0">
            <Users className="h-4 w-4" />
            <span className="inline">Пользователи</span>
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="gap-2 min-w-[100px] flex-shrink-0">
            <Workflow className="h-4 w-4" />
            <span className="inline">Воронки</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 min-w-[130px] flex-shrink-0">
            <Bell className="h-4 w-4" />
            <span className="inline">Уведомления</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2 min-w-[120px] flex-shrink-0">
            <Plug className="h-4 w-4" />
            <span className="inline">Интеграции</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2 min-w-[100px] flex-shrink-0">
            <Database className="h-4 w-4" />
            <span className="inline">Система</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="gap-2 min-w-[100px] flex-shrink-0 bg-orange-100 data-[state=active]:bg-orange-200 dark:bg-orange-900/30 dark:data-[state=active]:bg-orange-800/50">
            <AlertCircle className="h-4 w-4" />
            <span className="inline">Отладка</span>
          </TabsTrigger>
        </TabsList>

        {/* Компания */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Информация о компании
              </CardTitle>
              <CardDescription>
                Основные данные вашей организации
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Название компании</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ООО Моя Компания"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyEmail"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="pl-9"
                      placeholder="info@company.uz"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Телефон</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyPhone"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="pl-9"
                      placeholder="+998 90 123 45 67"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Веб-сайт</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyWebsite"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      className="pl-9"
                      placeholder="www.company.uz"
                    />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} className="gap-2" disabled={savingCompany}>
                  {savingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Сохранить изменения
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Региональные настройки</CardTitle>
              <CardDescription>
                Валюта, налоги и форматы данных
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Валюта</Label>
                  <select
                    id="currency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="UZS">🇺🇿 UZS - Узбекский сум</option>
                    <option value="USD">🇺🇸 USD - Доллар США</option>
                    <option value="EUR">🇪🇺 EUR - Евро</option>
                    <option value="RUB">🇷🇺 RUB - Российский рубль</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Часовой пояс</Label>
                  <select
                    id="timezone"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="Asia/Tashkent">Ташкент (UTC+5)</option>
                    <option value="Europe/Moscow">Москва (UTC+3)</option>
                    <option value="Europe/London">Лондон (UTC+0)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Формат даты</Label>
                  <select
                    id="dateFormat"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                  >
                    <option value="DD.MM.YYYY">ДД.ММ.ГГГГ (03.12.2024)</option>
                    <option value="MM/DD/YYYY">ММ/ДД/ГГГГ (12/03/2024)</option>
                    <option value="YYYY-MM-DD">ГГГГ-ММ-ДД (2024-12-03)</option>
                  </select>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveRegional} className="gap-2" disabled={savingRegional}>
                  {savingRegional ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Сохранить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Пользователи */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Управление пользователями
              </CardTitle>
              <CardDescription>
                Добавление сотрудников и настройка прав доступа
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Команда</h4>
                    <p className="text-sm text-muted-foreground">
                      Управление доступом сотрудников к CRM
                    </p>
                  </div>
                  <AddUserDialogButton onUserAdded={fetchUsers} />
                </div>
                <Separator />
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Нет добавленных пользователей</p>
                    <p className="text-sm">Нажмите кнопку выше, чтобы добавить первого пользователя</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity flex-1"
                          onClick={() => handleUserClick(user)}
                        >
                          <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.id)} flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <p className="font-medium break-all">{user.name}</p>
                            <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-between sm:justify-end w-full sm:w-auto">
                          <span className={`text-sm px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(user)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Роли и права доступа
              </CardTitle>
              <CardDescription>
                Настройка прав для различных ролей пользователей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">👑 Владелец</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Полный доступ ко всем функциям системы
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Все права</span>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">⭐ Менеджер</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Работа с лидами, сделками и задачами
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Лиды</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Сделки</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Задачи</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Компании</span>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">👁️ Наблюдатель</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Только посмотр данных без возможности редактирования
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Чтение</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Отчёты</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Воронки */}
        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Воронки продаж
              </CardTitle>
              <CardDescription>
                Настройка этапов воронок и автоматизации процессов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingPipelines ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pipelines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Workflow className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Нет созданных воронок</p>
                    <p className="text-sm">Нажмите кнопку ниже, чтобы создать первую воронку</p>
                  </div>
                ) : (
                  pipelines.map((pipeline) => (
                    <div 
                      key={pipeline.id} 
                      className={`p-4 border rounded-lg ${pipeline.isDefault ? 'bg-blue-50 dark:bg-blue-950 border-blue-200' : 'bg-white dark:bg-gray-800'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{pipeline.name}</h4>
                          {pipeline.isDefault && (
                            <Badge variant="default" className="bg-blue-600 whitespace-nowrap">
                              <Star className="h-3 w-3 mr-1" />
                              Основная
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleEditPipeline(pipeline)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Изменить
                          </Button>
                          {!pipeline.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleDeletePipeline(pipeline)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {pipeline.description && (
                        <p className="text-sm text-muted-foreground mb-3">{pipeline.description}</p>
                      )}
                      
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {pipeline.stages.map((stage) => (
                          <div 
                            key={stage.id} 
                            className="min-w-[150px] p-3 bg-white dark:bg-gray-800 rounded border-l-4"
                            style={{ borderLeftColor: stage.color }}
                          >
                            <p className="font-medium text-sm">{stage.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">Этап {stage.order}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                <Button variant="outline" className="w-full" onClick={handleCreatePipeline}>
                  <Workflow className="h-4 w-4 mr-2" />
                  Создать новую воронку
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Автоматизация</CardTitle>
              <CardDescription>
                Настройка автоматических действий в воронке
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-4">
                <div>
                  <p className="font-medium text-sm">Автоматическое создание задач</p>
                  <p className="text-xs text-muted-foreground">При переходе на этап "Квалификация" создаётся задача "Подготовить документы"</p>
                </div>
                <Switch 
                    checked={autoCreateTasks} 
                    onCheckedChange={setAutoCreateTasks} 
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-4">
                <div>
                  <p className="font-medium text-sm">Уведомления о зависших сделках</p>
                  <p className="text-xs text-muted-foreground">В Telegram, если сделка не обновлялась 7 дней</p>
                </div>
                <Switch 
                    checked={stalledNotifications}
                    onCheckedChange={setStalledNotifications}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-4">
                <div>
                  <p className="font-medium text-sm">Отправка email при выигрыше</p>
                  <p className="text-xs text-muted-foreground">Автоматическое письмо клиенту с благодарностью</p>
                </div>
                <Switch 
                    checked={emailOnWin}
                    onCheckedChange={setEmailOnWin}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveAutomation} className="gap-2" disabled={savingAutomation}>
                  {savingAutomation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Сохранить настройки
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Уведомления */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Настройки уведомлений
              </CardTitle>
              <CardDescription>
                Управление способами получения уведомлений
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Email уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать уведомления на электронную почту
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Push-уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Показывать уведомления в браузере
                  </p>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Уведомления о сделках</Label>
                  <p className="text-sm text-muted-foreground">
                    При изменении статуса или суммы сделки
                  </p>
                </div>
                <Switch
                  checked={dealNotifications}
                  onCheckedChange={setDealNotifications}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Уведомления о задачах</Label>
                  <p className="text-sm text-muted-foreground">
                    Напоминания о дедлайнах и новых задачах
                  </p>
                </div>
                <Switch
                  checked={taskNotifications}
                  onCheckedChange={setTaskNotifications}
                />
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} className="gap-2" disabled={savingNotifications}>
                  {savingNotifications ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Сохранить настройки
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Интеграции */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Интеграции
              </CardTitle>
              <CardDescription>
                Подключение внешних сервисов к CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Email (Resend) */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg transition-colors gap-4 ${integrationsStatus.resend ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Email (Resend)</p>
                      <p className="text-sm text-muted-foreground">Отправка писем клиентам</p>
                    </div>
                  </div>
                  {integrationsStatus.resend ? (
                    <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                        <Badge variant="outline" className="border-green-600 text-green-600 bg-white dark:bg-green-950/30 whitespace-nowrap">
                            <Check className="h-3 w-3 mr-1" />
                            Подключено
                        </Badge>
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" size="sm" onClick={() => handleDisconnectIntegration('resend')}>
                            Отключить
                        </Button>
                    </div>
                  ) : (
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openIntegrationDialog({
                        name: 'Email (Resend)',
                        type: 'resend',
                        description: 'Настройка отправки email через Resend API',
                        icon: <Mail className="h-5 w-5" />,
                        fields: [
                            { name: 'apiKey', label: 'API ключ', type: 'password', placeholder: 're_...' },
                        ],
                        docUrl: 'https://resend.com/docs'
                        })}
                    >
                        Подключить
                    </Button>
                  )}
                </div>

                {/* Telegram Bot */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg transition-colors gap-4 ${integrationsStatus.telegram ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                      <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">Telegram Bot</p>
                      <p className="text-sm text-muted-foreground">Прием рецептов и отчетов производства</p>
                      {integrationsStatus.telegram && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Требуется настройка API — см. раздел «Отладка»</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {integrationsStatus.telegram ? (
                    <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                        <Badge variant="outline" className="border-green-600 text-green-600 bg-white dark:bg-green-950/30 whitespace-nowrap">
                            <Check className="h-3 w-3 mr-1" />
                            Подключено
                        </Badge>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openIntegrationDialog({
                                name: 'Telegram Bot',
                                type: 'telegram',
                                description: 'Обновление подключения Telegram бота',
                                icon: <Smartphone className="h-5 w-5 text-purple-600" />,
                                fields: [
                                    { name: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'Введите токен заново для обновления' },
                                ],
                                docUrl: 'https://core.telegram.org/bots'
                            })}
                        >
                            Настроить
                        </Button>
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" size="sm" onClick={() => handleDisconnectIntegration('telegram')}>
                            Отключить
                        </Button>
                    </div>
                  ) : (
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openIntegrationDialog({
                        name: 'Telegram Bot',
                        type: 'telegram',
                        description: 'Подключение Telegram бота для уведомлений',
                        icon: <Smartphone className="h-5 w-5 text-purple-600" />,
                        fields: [
                            { name: 'botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF...' },
                        ],
                        docUrl: 'https://core.telegram.org/bots'
                        })}
                    >
                        Подключить
                    </Button>
                  )}
                </div>

                {/* Google Sheets */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg transition-colors gap-4 ${integrationsStatus.google ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
                      <Database className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Google Sheets</p>
                      <p className="text-sm text-muted-foreground">Экспорт данных в таблицы</p>
                    </div>
                  </div>
                   {integrationsStatus.google ? (
                    <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                        <Badge variant="outline" className="border-green-600 text-green-600 bg-white dark:bg-green-950/30 whitespace-nowrap">
                            <Check className="h-3 w-3 mr-1" />
                            Подключено
                        </Badge>
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" size="sm" onClick={() => handleDisconnectIntegration('google')}>
                            Отключить
                        </Button>
                    </div>
                  ) : (
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openIntegrationDialog({
                        name: 'Google Sheets',
                        type: 'google',
                        description: 'Автоматический экспорт данных в Google Sheets',
                        icon: <Database className="h-5 w-5 text-orange-600" />,
                        fields: [
                            { name: 'sheetId', label: 'ID таблицы', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' },
                            { name: 'clientEmail', label: 'Service Account Email', type: 'text', placeholder: 'service-account@...' },
                            { name: 'privateKey', label: 'Private Key', type: 'password', placeholder: '-----BEGIN PRIVATE KEY-----...' },
                        ],
                        docUrl: 'https://developers.google.com/sheets/api'
                        })}
                    >
                        Подключить
                    </Button>
                  )}
                </div>

                {/* OpenAI */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold">AI</span>
                    </div>
                    <div>
                      <p className="font-medium">OpenAI</p>
                      <p className="text-sm text-muted-foreground">AI-ассистент для продаж</p>
                    </div>
                  </div>
                  <span className="text-sm px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full w-fit whitespace-nowrap">
                    Активно (через Env)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API и Webhooks</CardTitle>
              <CardDescription>
                Доступ к REST API и настройка веб-хуков
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API ключ</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value="crm_live_••••••••••••••••••••"
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={() => toast.success('API ключ скопирован')}>
                    Копировать
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Используйте этот ключ для аутентификации API запросов
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Webhooks</Label>
                  <Button variant="outline" size="sm">Добавить webhook</Button>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">Новая сделка</p>
                    <Switch />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    https://yourdomain.com/webhooks/new-deal
                  </p>
                </div>
              </div>

              <DebugLogs />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Интеграционный диалог */}
        <IntegrationDialog
          open={integrationDialogOpen}
          onOpenChange={setIntegrationDialogOpen}
          integration={selectedIntegration}
          onSave={handleSaveIntegration}
        />

        {/* Диалог редактирования пользователя */}
        <EditUserDialog
          open={editUserDialogOpen}
          onOpenChange={setEditUserDialogOpen}
          user={selectedUser}
          onUserUpdated={fetchUsers}
        />

        {/* Диалог деталей пользователя */}
        <UserDetailDialog
          user={selectedUserForDetail}
          open={userDetailDialogOpen}
          onOpenChange={setUserDetailDialogOpen}
          onEdit={handleEditUser}
          onDelete={handleDeleteClick}
        />

        {/* Диалог подтверждения удаления */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить пользователя{' '}
                <strong>{userToDelete?.name}</strong>? Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingUser}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="bg-red-500 hover:bg-red-600"
              >
                {deletingUser ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  'Удалить'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог создания воронки */}
        <CreatePipelineDialog
          open={createPipelineDialogOpen}
          onOpenChange={setCreatePipelineDialogOpen}
          onSuccess={fetchPipelines}
        />

        {/* Диалог редактирования воронки */}
        <EditPipelineDialog
          open={editPipelineDialogOpen}
          onOpenChange={setEditPipelineDialogOpen}
          pipeline={selectedPipeline}
          onPipelineUpdated={fetchPipelines}
        />

        {/* Диалог подтверждения удаления воронки */}
        <AlertDialog open={deletePipelineDialogOpen} onOpenChange={setDeletePipelineDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить воронку?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить воронку{' '}
                <strong>{pipelineToDelete?.name}</strong>? Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingPipeline}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePipelineConfirm}
                disabled={deletingPipeline}
                className="bg-red-500 hover:bg-red-600"
              >
                {deletingPipeline ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  'Удалить'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Система */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Системная информация
              </CardTitle>
              <CardDescription>
                Технические параметры и данные о системе
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Версия CRM</p>
                  <p className="font-medium">2.0.0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">База данных</p>
                  <p className="font-medium">PostgreSQL (Railway)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Хранилище</p>
                  <p className="font-medium">KV Store</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Регион</p>
                  <p className="font-medium">🇺🇿 Узбекистан</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Статистика использования</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold">156</p>
                    <p className="text-xs text-muted-foreground">Лидов</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold">89</p>
                    <p className="text-xs text-muted-foreground">Сделок</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold">234</p>
                    <p className="text-xs text-muted-foreground">Задач</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Резервное копирование</CardTitle>
              <CardDescription>
                Управление бэкапами данных системы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-4">
                <div>
                  <p className="font-medium text-sm">Автоматическое резервное копирование</p>
                  <p className="text-xs text-muted-foreground">Ежедневно в 03:00</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-sm font-medium mb-1">Последний бэкап</p>
                <p className="text-xs text-muted-foreground">03 декабря 2024, 03:00</p>
              </div>
              <Button variant="outline" className="w-full">
                <Database className="h-4 w-4 mr-2" />
                Создать резервную копию сейчас
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Опасная зона
              </CardTitle>
              <CardDescription>
                Действия, которые могут привести к потере данных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-100 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 rounded-lg gap-4">
                <div>
                  <p className="font-medium text-red-900 dark:text-red-200">Полный сброс базы данных</p>
                  <p className="text-sm text-red-700 dark:text-red-300/70">Удалить все сделки, клиентов и контакты</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleResetDatabase}
                  disabled={resetting}
                  className="w-full sm:w-auto"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сбросить данные'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Отладка */}
        <TabsContent value="debug" className="space-y-4">
          <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-900/10 dark:border-orange-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Отладка Telegram Webhook
              </CardTitle>
              <CardDescription>
                Мониторинг и устранение проблем с приемом сообщений от Telegram бота
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DebugLogs />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}