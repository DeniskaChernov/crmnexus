import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../../components/ui/button';
import { CreateTaskDialog } from '../../components/crm/CreateTaskDialog';
import { EditTaskDialog } from '../../components/crm/EditTaskDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { AlertCircle, RefreshCcw, Calendar as CalendarIcon, Phone, Mail, Users, CheckCircle2, Pencil, Trash2, Clock, Download, Loader2, Briefcase, User, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { downloadCSV, formatDateForExport } from '../../utils/exportUtils';
import { useCrmAiClient } from '../../context/CrmAiClientContext.tsx';
import { TaskLabPage } from '../../components/tasklab';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'planned' | 'done';
  type: 'call' | 'meeting' | 'email' | 'task';
  contact_id?: string;
  deal_id?: string;
  created_at: string;
  deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export default function Tasks() {
  const { setFocus, clearFocus } = useCrmAiClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [activeTab, setActiveTab] = useState('planned');
  const [expandedColumns, setExpandedColumns] = useState<{ client: boolean; employee: boolean }>({
    client: false,
    employee: false
  });
  const INITIAL_TASK_BATCH = 8;
  const TASK_BATCH_STEP = 12;
  const [visibleByColumn, setVisibleByColumn] = useState<{ client: number; employee: number }>({
    client: INITIAL_TASK_BATCH,
    employee: INITIAL_TASK_BATCH,
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await crm
        .from('tasks')
        .select(`
          *,
          deals:deal_id(id, title),
          contacts:contact_id(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const toggleTaskStatus = useCallback(async (task: Task) => {
    const newStatus = task.status === 'done' ? 'planned' : 'done';
    try {
      const { error } = await crm
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
      
      if (error) throw error;
      
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      toast.success(newStatus === 'done' ? 'Задача выполнена' : 'Задача возвращена в работу');
    } catch (err) {
      console.error('Error updating task status:', err);
      toast.error('Ошибка при обновлении статуса');
    }
  }, []);

  const handleDeleteClick = useCallback((task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  }, []);

  const deleteTask = async () => {
    if (!taskToDelete) return;

    setDeletingTask(true);
    try {
      const { error } = await crm
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      toast.success('Задача удалена');
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (err: any) {
      console.error('Error deleting task:', err);
      toast.error('Ошибка при удалении задачи');
    } finally {
      setDeletingTask(false);
    }
  };

  const handleEditTask = useCallback(
    (task: Task) => {
      setEditingTask(task);
      setEditDialogOpen(true);
      setFocus({ kind: "task", id: task.id, label: task.title });
    },
    [setFocus],
  );

  const getTaskCategory = (task: Task) => {
    // Client actions: call, meeting, email OR linked to deal/contact
    if (['call', 'meeting', 'email'].includes(task.type)) return 'client';
    if (task.contact_id || task.deal_id) return 'client';
    return 'employee';
  };

  const plannedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'planned'),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done'),
    [tasks],
  );
  const todayTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => {
      if (!t.due_date || t.status === 'done') return false;
      const date = new Date(t.due_date);
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });
  }, [tasks]);
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < now;
    });
  }, [tasks]);

  const tasksForExport = useMemo(() => {
    switch (activeTab) {
      case 'planned':
        return plannedTasks;
      case 'today':
        return todayTasks;
      case 'overdue':
        return overdueTasks;
      case 'done':
        return doneTasks;
      default:
        return tasks;
    }
  }, [activeTab, plannedTasks, todayTasks, overdueTasks, doneTasks, tasks]);

  const exportTasks = () => {
    if (tasksForExport.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const priorityMap: Record<string, string> = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий'
    };

    const typeMap: Record<string, string> = {
      'call': 'Звонок',
      'meeting': 'Встреча',
      'email': 'Email',
      'task': 'Задача',
      'other': 'Другое'
    };

    const statusMap: Record<string, string> = {
      'planned': 'Запланировано',
      'done': 'Выполнено'
    };

    const exportData = tasksForExport.map(task => ({
      'Название': task.title,
      'Описание': task.description || '',
      'Тип': typeMap[task.type] || task.type,
      'Приоритет': priorityMap[task.priority],
      'Статус': statusMap[task.status],
      'Срок': formatDateForExport(task.due_date),
      'Дата создания': formatDateForExport(task.created_at)
    }));

    downloadCSV(exportData, `tasks-${new Date().toISOString().split('T')[0]}`);
    toast.success('Задачи экспортированы');
  };

  useEffect(() => {
    setVisibleByColumn({
      client: INITIAL_TASK_BATCH,
      employee: INITIAL_TASK_BATCH,
    });
  }, [activeTab, tasks.length]);

  const toggleColumn = useCallback((column: 'client' | 'employee') => {
    setExpandedColumns((prev) => {
      const nextOpen = !prev[column];
      if (nextOpen) {
        setVisibleByColumn((vis) => ({ ...vis, [column]: INITIAL_TASK_BATCH }));
      }
      return {
        ...prev,
        [column]: nextOpen
      };
    });
  }, []);

  const renderTaskColumn = (title: string, columnTasks: Task[], icon: React.ReactNode, columnType: 'client' | 'employee') => {
    const isExpanded = expandedColumns[columnType];
    const PREVIEW_COUNT = 2;
    const displayLimit = isExpanded ? visibleByColumn[columnType] : PREVIEW_COUNT;
    const displayTasks = columnTasks.slice(0, displayLimit);
    const hasMore = columnTasks.length > PREVIEW_COUNT;
    const hasMoreExpanded = isExpanded && columnTasks.length > displayLimit;

    return (
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="tasklab-card border-0 shadow-none">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 md:p-2 bg-neutral-50 rounded-lg text-neutral-500">
                  {icon}
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-neutral-900">{title}</h3>
                  <p className="text-[10px] md:text-xs text-neutral-500">{columnTasks.length} задач</p>
                </div>
              </div>
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleColumn(columnType)}
                  className="text-xs gap-1 h-7 md:h-8 px-2"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Свернуть</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Показать все</span>
                      <span className="sm:hidden">+{columnTasks.length - PREVIEW_COUNT}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 p-3 md:p-6 md:pt-0">
            <div className="space-y-2 md:space-y-3">
              {columnTasks.length === 0 ? (
                <div className="text-center py-6 md:py-8 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200">
                  <p className="text-xs md:text-sm text-neutral-500">Нет задач в этой категории</p>
                </div>
              ) : (
                <>
                  {displayTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onToggleStatus={toggleTaskStatus}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                  
                  {hasMore && !isExpanded && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleColumn(columnType)}
                      className="w-full text-xs gap-1 border-dashed h-8"
                    >
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
                      Показать ещё {columnTasks.length - PREVIEW_COUNT} {columnTasks.length - PREVIEW_COUNT === 1 ? 'задачу' : 'задач'}
                    </Button>
                  )}
                  {hasMoreExpanded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setVisibleByColumn((prev) => ({
                          ...prev,
                          [columnType]: prev[columnType] + TASK_BATCH_STEP,
                        }))
                      }
                      className="w-full text-xs h-8 text-neutral-500 hover:text-neutral-900"
                    >
                      Загрузить ещё {Math.min(TASK_BATCH_STEP, columnTasks.length - displayLimit)}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTabContent = (filtered: Task[]) => {
    const clientTasks = filtered.filter((t) => getTaskCategory(t) === 'client');
    const employeeTasks = filtered.filter((t) => getTaskCategory(t) === 'employee');

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mt-4 md:mt-6">
        {renderTaskColumn("Действия с клиентом", clientTasks, <Users className="h-5 w-5" />, 'client')}
        {renderTaskColumn("Задачи сотрудников", employeeTasks, <ClipboardList className="h-5 w-5" />, 'employee')}
      </div>
    );
  };

  return (
    <TaskLabPage
      tag="Задачи"
      title="Задачи"
      subtitle="Планирование и контроль"
      actions={
        <>
          <Button variant="outline" onClick={exportTasks}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
          <CreateTaskDialog onSuccess={fetchTasks} />
        </>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchTasks} className="ml-4 bg-white text-red-600 hover:bg-red-50 border-red-200">
              <RefreshCcw className="mr-2 h-3 w-3" />
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="planned" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="planned">План</TabsTrigger>
          <TabsTrigger value="today">Сегодня</TabsTrigger>
          <TabsTrigger value="overdue">Просрочено</TabsTrigger>
          <TabsTrigger value="done">Архив</TabsTrigger>
        </TabsList>
        
        <TabsContent value="planned">
          {renderTabContent(plannedTasks)}
        </TabsContent>

        <TabsContent value="today">
           {renderTabContent(todayTasks)}
        </TabsContent>

        <TabsContent value="overdue">
            {renderTabContent(overdueTasks)}
        </TabsContent>

        <TabsContent value="done">
            {renderTabContent(doneTasks)}
        </TabsContent>
      </Tabs>

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) clearFocus();
          }}
          onSuccess={fetchTasks}
        />
      )}

      {deleteDialogOpen && taskToDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удаление задачи</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить задачу "{taskToDelete.title}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteTask}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Удалить'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TaskLabPage>
  );
}

interface TaskCardProps {
  task: Task;
  onToggleStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const TaskCard = React.memo(function TaskCard({ task, onToggleStatus, onEdit, onDelete }: TaskCardProps) {
  const getTypeIcon = () => {
    switch (task.type) {
      case 'call':
        return <Phone className="h-4 w-4 text-neutral-900" />;
      case 'meeting':
        return <Users className="h-4 w-4 text-neutral-700" />;
      case 'email':
        return <Mail className="h-4 w-4 text-neutral-700" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getPriorityBadge = () => {
    switch (task.priority) {
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Высокий</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">Средний</span>;
      case 'low':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-[var(--tasklab-lime)]/25 text-neutral-800">Низкий</span>;
    }
  };

  const getTypeLabel = () => {
    switch (task.type) {
      case 'call': return 'Звонок';
      case 'meeting': return 'Встреча';
      case 'email': return 'Email';
      case 'task': return 'Задача';
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <Card className={`tasklab-card group transition-all duration-300 hover:shadow-md hover:-translate-y-[1px] ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <CardHeader className="p-2.5 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <div className="pt-0.5">
            <Checkbox 
              checked={task.status === 'done'}
              onCheckedChange={() => onToggleStatus(task)}
              className="h-4 w-4 md:h-5 md:w-5 rounded-full"
            />
          </div>
          
          <div className="flex-1 space-y-1 md:space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className={`text-xs md:text-sm font-medium ${task.status === 'done' ? 'line-through text-neutral-500' : 'text-neutral-900'}`}>
                  {task.title}
                </CardTitle>
                {task.description && (
                  <p className="text-[11px] md:text-xs text-neutral-500 mt-0.5 md:mt-1 line-clamp-1 md:line-clamp-2">{task.description}</p>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onEdit(task)}
                  className="h-6 w-6 md:h-7 md:w-7 p-0 text-neutral-400 hover:text-neutral-900"
                >
                  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onDelete(task)}
                  className="h-6 w-6 md:h-7 md:w-7 p-0 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs text-neutral-500">
              <div className="flex items-center gap-1 bg-neutral-50 px-1.5 md:px-2 py-0.5 rounded border border-neutral-100">
                {getTypeIcon()}
                <span className="text-[10px] md:text-xs">{getTypeLabel()}</span>
              </div>
              
              <div className="hidden md:flex items-center gap-1 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100" title="Дата создания">
                <Clock className="h-3 w-3 text-neutral-400" />
                <span>{new Date(task.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
              
              {task.due_date && (
                <div className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded border ${isOverdue ? 'bg-red-50 text-red-700 border-red-100' : 'bg-neutral-50 border-neutral-100'}`} title="Срок выполнения">
                  <CalendarIcon className="h-3 w-3" />
                  <span className="text-[10px] md:text-xs">
                    {new Date(task.due_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  </span>
                  {isOverdue && <Clock className="h-3 w-3 ml-0.5" />}
                </div>
              )}
              
              <div className="hidden md:block">
                {getPriorityBadge()}
              </div>

              {task.deals && (
                <div className="flex items-center gap-1 bg-[var(--tasklab-lime)]/15 px-1.5 md:px-2 py-0.5 rounded text-neutral-900 border border-neutral-200">
                  <Briefcase className="h-3 w-3" />
                  <span className="truncate max-w-[80px] md:max-w-[100px] text-[10px] md:text-xs">{task.deals.title}</span>
                </div>
              )}

              {task.contacts && (
                <div className="flex items-center gap-1 bg-green-50 px-1.5 md:px-2 py-0.5 rounded text-green-700 border border-green-100">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[80px] md:max-w-[100px] text-[10px] md:text-xs">{task.contacts.first_name} {task.contacts.last_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});

TaskCard.displayName = 'TaskCard';