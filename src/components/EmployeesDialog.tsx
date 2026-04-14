import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus, User, Users } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
interface Employee {
  id: string;
  name: string;
  active: boolean;
  hourlyRate?: number;
}

interface EmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void; // Callback to refresh parent list
}

export function EmployeesDialog({ open, onOpenChange, onUpdate }: EmployeesDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${crmUrl('/employees')}`, {
        headers: { ...authHeaders(false) }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.sort((a: Employee, b: Employee) => a.name.localeCompare(b.name)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${crmUrl('/employees')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({ 
          name: newName.trim(),
          hourlyRate: parseFloat(newRate) || 0
        })
      });
      
      if (res.ok) {
        toast.success("Сотрудник добавлен");
        setNewName('');
        setNewRate('');
        fetchEmployees();
        onUpdate();
      }
    } catch (e) {
      toast.error("Ошибка при добавлении");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить этого сотрудника?")) return;
    try {
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
      await fetch(`${crmUrl(`/employees/${id}`)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(false) }
      });
      toast.success("Сотрудник удален");
      fetchEmployees();
      onUpdate();
    } catch (e) {
      toast.error("Ошибка при удалении");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Сотрудники
          </DialogTitle>
          <DialogDescription>
            Управление списком мастеров и их ставками.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <Input 
              placeholder="Имя" 
              className="col-span-2"
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
             <Input 
              placeholder="Ставка" 
              type="number"
              value={newRate} 
              onChange={e => setNewRate(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding || !newName.trim()} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>

          <div className="rounded-md border max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Загрузка...</div>
            ) : employees.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Нет сотрудников</div>
            ) : (
              <div className="divide-y">
                {employees.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {emp.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{emp.name}</span>
                        <span className="text-xs text-slate-500">
                          {emp.hourlyRate ? `${emp.hourlyRate.toLocaleString()} сум/час` : 'Ставка не задана'}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(emp.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}