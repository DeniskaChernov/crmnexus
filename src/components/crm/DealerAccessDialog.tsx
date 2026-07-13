import React, { useEffect, useState } from "react";
import { crmUrl, authHeaders } from "../../lib/crmApi.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner@2.0.3";
import { KeyRound, Trash2, Loader2 } from "lucide-react";

type DealerUser = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

interface DealerAccessDialogProps {
  company: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealerAccessDialog({ company, open, onOpenChange }: DealerAccessDialogProps) {
  const [users, setUsers] = useState<DealerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await fetch(crmUrl(`/companies/${company.id}/dealer-access`), {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && company) void load();
  }, [open, company?.id]);

  const grantAccess = async () => {
    if (!company || !email || !password) {
      toast.error("Укажите email и пароль");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(crmUrl(`/companies/${company.id}/dealer-access`), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast.success("Доступ дилера выдан");
      setEmail("");
      setPassword("");
      setName("");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось выдать доступ");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (userId: string) => {
    if (!company || !confirm("Отозвать доступ дилера?")) return;
    const res = await fetch(crmUrl(`/companies/${company.id}/dealer-access/${userId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      toast.success("Доступ отозван");
      await load();
    } else {
      toast.error("Не удалось отозвать доступ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Доступ в портал дилера
          </DialogTitle>
          <DialogDescription>
            {company?.name} — отдельный вход на <code>/dealer</code>, без доступа к основной CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border p-3 space-y-3 bg-neutral-50">
            <div className="text-sm font-medium">Создать / обновить логин</div>
            <div className="grid gap-2">
              <Label>Имя</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Дилер" />
            </div>
            <div className="grid gap-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dealer@mail.com" />
            </div>
            <div className="grid gap-2">
              <Label>Пароль *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button onClick={() => void grantAccess()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Выдать доступ
            </Button>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Активные аккаунты</div>
            {loading ? (
              <p className="text-sm text-neutral-500">Загрузка…</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-neutral-500">Нет аккаунтов дилера</p>
            ) : (
              <ul className="space-y-2">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{u.name || u.email}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => void revoke(u.id)} title="Отозвать">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
