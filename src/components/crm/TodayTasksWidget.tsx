import React, { useEffect, useState } from 'react';
import { crm } from "@/lib/crmClient.ts";
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Calendar, Phone, Mail, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Link } from 'react-router-dom';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'planned' | 'done';
  type: 'call' | 'meeting' | 'email' | 'task';
  deals?: { title: string } | null;
  contacts?: { first_name: string; last_name: string } | null;
}

export function TodayTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayTasks();
  }, []);

  const fetchTodayTasks = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await crm
        .from('tasks')
        .select(`
          *,
          deals:deal_id(title),
          contacts:contact_id(first_name, last_name)
        `)
        .eq('status', 'planned')
        .gte('due_date', today.toISOString())
        .lt('due_date', tomorrow.toISOString())
        .order('priority', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching today tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const { error } = await crm
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success('Задача выполнена');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Ошибка при обновлении задачи');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-3.5 w-3.5 text-blue-500" />;
      case 'meeting': return <Users className="h-3.5 w-3.5 text-purple-500" />;
      case 'email': return <Mail className="h-3.5 w-3.5 text-green-500" />;
      default: return <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <Card className="soft-card h-[300px] flex items-center justify-center">
         <div className="text-slate-300 text-sm">Loading tasks...</div>
      </Card>
    );
  }

  return (
    <Card className="soft-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-red-500"></div>
             СЕГОДНЯ
          </CardTitle>
          {tasks.length > 0 && (
             <span className="text-xs font-bold text-slate-500">{tasks.length}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-10">
            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
               <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Все задачи выполнены</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="group flex items-center gap-3">
                 <Checkbox 
                    checked={false} 
                    onCheckedChange={() => toggleTaskStatus(task.id)}
                    className="h-5 w-5 rounded-full border-2 border-slate-200 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all"
                 />
                 <div className="flex-1 min-w-0 p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                       {getTypeIcon(task.type)}
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{task.priority}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                    {(task.deals || task.contacts) && (
                       <p className="text-xs text-slate-500 mt-1 truncate">
                          {task.deals?.title || `${task.contacts?.first_name} ${task.contacts?.last_name}`}
                       </p>
                    )}
                 </div>
              </div>
            ))}
            
            <Link to="/tasks" className="block pt-2">
               <Button variant="ghost" className="w-full text-xs text-slate-400 hover:text-slate-900">
                  Показать все задачи <ArrowRight className="h-3 w-3 ml-2" />
               </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}