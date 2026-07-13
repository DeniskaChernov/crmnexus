import React, { useState, useEffect } from "react";
import { crmUrl, authHeaders, crmFetch } from "../../lib/crmApi.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Edit, Loader2 } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id?: string | null;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, onUserUpdated }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [companyId, setCompanyId] = useState("");
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setCompanyId(user.company_id || "");
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    crmFetch("/qr/dealers")
      .then(async (res) => {
        if (res.ok) setDealers(await res.json());
      })
      .catch(() => setDealers([]));
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !user) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    if (role === "dealer" && !companyId) {
      toast.error("Выберите компанию-дилера");
      return;
    }

    setLoading(true);

    try {
      const updatedUser: Record<string, unknown> = { ...user, name, email, role };
      if (role === "dealer") updatedUser.company_id = companyId;

      const response = await fetch(`${crmUrl(`/users/${user.id}`)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(false),
        },
        body: JSON.stringify(updatedUser),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка при обновлении пользователя");
      }

      toast.success("Данные пользователя обновлены");
      onUserUpdated();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось обновить пользователя");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tasklab-card border-0 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Редактировать пользователя
          </DialogTitle>
          <DialogDescription>Изменение данных и роли пользователя</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Имя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@company.uz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Роль</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">👑 Владелец</SelectItem>
                  <SelectItem value="manager">⭐ Менеджер</SelectItem>
                  <SelectItem value="observer">👁️ Наблюдатель</SelectItem>
                  <SelectItem value="dealer">🏪 Дилер (портал)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "dealer" && (
              <div className="space-y-2">
                <Label>Компания-дилер</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите дилера" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
