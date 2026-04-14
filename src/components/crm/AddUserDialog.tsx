import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    
    try {
      // Создаем нового пользователя
      const newUser = {
        name,
        email,
        role,
        password,
      };

      const response = await fetch(
        `${crmUrl('/users')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify(newUser),
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при добавлении пользователя');
      }

      toast.success(`Пользователь ${name} успешно добавлен`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('manager');
      onUserAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Не удалось добавить пользователя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Добавить пользователя
          </DialogTitle>
          <DialogDescription>
            Создайте нового пользователя и назначьте ему роль
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Имя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@company.uz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Пароль <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">👑 Владелец</SelectItem>
                  <SelectItem value="manager">⭐ Менеджер</SelectItem>
                  <SelectItem value="observer">👁️ Наблюдатель</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Права роли "{role === 'owner' ? 'Владелец' : role === 'manager' ? 'Менеджер' : 'Наблюдатель'}":</strong>
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 ml-4 list-disc">
                {role === 'owner' && (
                  <>
                    <li>Полный доступ ко всем функциям</li>
                    <li>Управление пользователями и настройками</li>
                    <li>Доступ к финансовым данным</li>
                  </>
                )}
                {role === 'manager' && (
                  <>
                    <li>Работа с лидами, сделками и задачами</li>
                    <li>Просмотр отчётов</li>
                    <li>Редактирование компаний и контактов</li>
                  </>
                )}
                {role === 'observer' && (
                  <>
                    <li>Просмотр данных без редактирования</li>
                    <li>Доступ к отчётам и аналитике</li>
                    <li>Нет доступа к настройкам</li>
                  </>
                )}
              </ul>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Добавление...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Добавить
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}