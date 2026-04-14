import React from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Key,
  Edit,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface UserDetailDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: UserData) => void;
  onDelete: (user: UserData) => void;
}

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Администратор',
    manager: 'Менеджер',
    owner: 'Владелец',
    warehouse: 'Складской работник',
    accountant: 'Бухгалтер',
  };
  return labels[role] || role;
};

const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    owner: 'bg-amber-100 text-amber-800',
    warehouse: 'bg-green-100 text-green-800',
    accountant: 'bg-cyan-100 text-cyan-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

const getRolePermissions = (role: string): string[] => {
  const permissions: Record<string, string[]> = {
    owner: [
      'Полный доступ ко всей системе',
      'Управление пользователями',
      'Управление складами',
      'Управление сделками',
      'Доступ к отчетам',
      'Управление зарплатами',
      'Настройки системы',
    ],
    admin: [
      'Полный доступ ко всей системе',
      'Управление пользователями',
      'Управление складами',
      'Управление сделками',
      'Доступ к отчетам',
      'Управление зарплатами',
    ],
    manager: [
      'Управление сделками',
      'Просмотр клиентов',
      'Создание отчетов',
      'Просмотр склада',
    ],
    warehouse: [
      'Управление складом',
      'Приём товаров',
      'Выдача товаров',
      'Печать этикеток',
      'Перемещение товаров',
    ],
    accountant: [
      'Доступ к финансам',
      'Управление зарплатами',
      'Просмотр отчетов',
      'Расчет зарплат',
    ],
  };
  return permissions[role] || ['Базовый доступ'];
};

const getAvatarColor = (id: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-teal-500',
  ];
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Неизвестно';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function UserDetailDialog({
  user,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: UserDetailDialogProps) {
  const [isResetting, setIsResetting] = React.useState(false);

  if (!user) return null;

  const handleResetPassword = async () => {
    setIsResetting(true);
    try {
      const response = await fetch(
        `${crmUrl('/reset-password')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data = await response.json();
      
      // Копируем новый пароль в буфер обмена
      await navigator.clipboard.writeText(data.newPassword);
      
      toast.success(`Пароль сброшен успешно!`, {
        description: `Новый пароль скопирован в буфер обмена: ${data.newPassword}`,
        duration: 10000,
      });
    } catch (error) {
      console.error('Ошибка при сбросе пароля:', error);
      toast.error('Не удалось сбросить пароль', {
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const permissions = getRolePermissions(user.role);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full ${getAvatarColor(
                user.id
              )} flex items-center justify-center text-white font-semibold text-lg`}
            >
              {getInitials(user.name)}
            </div>
            <div>
              <div className="text-xl">{user.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                Детали пользователя
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Подробная информация о пользователе {user.name}, включая контактные данные, роль и разрешения
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Основная информация */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Основная информация
            </h3>
            <div className="space-y-2 pl-6">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm font-medium break-all">{user.email}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Роль</div>
                  <Badge className={`${getRoleColor(user.role)} mt-1`}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Дата создания</div>
                  <div className="text-sm">{formatDate(user.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Права доступа */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Права доступа
            </h3>
            <div className="pl-6">
              <ul className="space-y-1.5">
                {permissions.map((permission, index) => (
                  <li
                    key={index}
                    className="text-sm flex items-start gap-2 text-muted-foreground"
                  >
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator />

          {/* Действия */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" />
              Действия
            </h3>
            <div className="pl-6 space-y-2">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <strong>О паролях:</strong> Пароли хранятся в зашифрованном виде и не могут быть просмотрены. 
                  Вы можете сбросить пароль - система сгенерирует новый случайный пароль.
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResetPassword}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Сброс пароля...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Сбросить пароль
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Кнопки управления */}
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                onEdit(user);
                onOpenChange(false);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                onDelete(user);
                onOpenChange(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}