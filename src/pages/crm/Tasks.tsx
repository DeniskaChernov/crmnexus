import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
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
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'planned' : 'done';
    try {
      const { error } = await crm
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
      
      if (error) throw error;
      
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      toast.success(newStatus === 'done' ? 'Задача выполнена' : 'Задача возвращена в работу');
    } catch (err) {
      console.error('Error updating task status:', err);
      toast.error('Ошибка при обновлении статуса');
    }
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

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
      fetchTasks();
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (err: any) {
      console.error('Error deleting task:', err);
      toast.error('Ошибка при удалении задачи');
    } finally {
      setDeletingTask(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditDialogOpen(true);
  };

  const exportTasks = () => {
    const filteredTasks = activeTab === 'all' ? tasks : tasks.filter(t => t.status === activeTab);

    if (filteredTasks.length === 0) {
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
      'other': 'Другое'
    };

    const statusMap: Record<string, string> = {
      'planned': 'Запланировано',
      'done': 'Выполнено'
    };

    const exportData = filteredTasks.map(task => ({
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

  const getTaskCategory = (task: Task) => {
    // Client actions: call, meeting, email OR linked to deal/contact
    if (['call', 'meeting', 'email'].includes(task.type)) return 'client';
    if (task.contact_id || task.deal_id) return 'client';
    return 'employee';
  };

  const toggleColumn = (column: 'client' | 'employee') => {
    setExpandedColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const renderTaskColumn = (title: string, columnTasks: Task[], icon: React.ReactNode, columnType: 'client' | 'employee') => {
    const isExpanded = expandedColumns[columnType];
    const PREVIEW_COUNT = 2;
    const displayTasks = isExpanded ? columnTasks : columnTasks.slice(0, PREVIEW_COUNT);
    const hasMore = columnTasks.length > PREVIEW_COUNT;

    return (
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg text-slate-500">
                  {icon}
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-slate-900">{title}</h3>
                  <p className="text-[10px] md:text-xs text-slate-500">{columnTasks.length} задач</p>
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
                <div className="text-center py-6 md:py-8 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <p className="text-xs md:text-sm text-slate-500">Нет задач в этой категории</p>
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
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTabContent = (statusFilter: (t: Task) => boolean) => {
    const filtered = tasks.filter(statusFilter);
    const clientTasks = filtered.filter(t => getTaskCategory(t) === 'client');
    const employeeTasks = filtered.filter(t => getTaskCategory(t) === 'employee');

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mt-4 md:mt-6">
        {renderTaskColumn("Действия с клиентом", clientTasks, <Users className="h-5 w-5" />, 'client')}
        {renderTaskColumn("Задачи сотрудников", employeeTasks, <ClipboardList className="h-5 w-5" />, 'employee')}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Задачи</h2>
          <p className="text-muted-foreground">Планирование и контроль</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTasks}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
          <CreateTaskDialog onSuccess={fetchTasks} />
        </div>
      </div>

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
          {renderTabContent(t => t.status === 'planned')}
        </TabsContent>

        <TabsContent value="today">
           {renderTabContent(t => {
             if (!t.due_date) return false;
             const date = new Date(t.due_date);
             const today = new Date();
             return date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear() &&
                    t.status !== 'done';
           })}
        </TabsContent>

        <TabsContent value="overdue">
            {renderTabContent(t => {
                if (!t.due_date) return false;
                return new Date(t.due_date) < new Date() && t.status !== 'done';
            })}
        </TabsContent>

        <TabsContent value="done">
            {renderTabContent(t => t.status === 'done')}
        </TabsContent>
      </Tabs>

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
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
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onToggleStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskCard({ task, onToggleStatus, onEdit, onDelete }: TaskCardProps) {
  const getTypeIcon = () => {
    switch (task.type) {
      case 'call':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'meeting':
        return <Users className="h-4 w-4 text-purple-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-slate-500" />;
    }
  };

  const getPriorityBadge = () => {
    switch (task.priority) {
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Высокий</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">Средний</span>;
      case 'low':
        return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Низкий</span>;
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
    <Card className={`group transition-all hover:shadow-md ${task.status === 'done' ? 'opacity-60' : ''}`}>
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
                <CardTitle className={`text-xs md:text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-slate-900'}`}>
                  {task.title}
                </CardTitle>
                {task.description && (
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 line-clamp-1 md:line-clamp-2">{task.description}</p>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onEdit(task)}
                  className="h-6 w-6 md:h-7 md:w-7 p-0 text-slate-400 hover:text-blue-600"
                >
                  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onDelete(task)}
                  className="h-6 w-6 md:h-7 md:w-7 p-0 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 bg-slate-50 px-1.5 md:px-2 py-0.5 rounded border border-slate-100">
                {getTypeIcon()}
                <span className="text-[10px] md:text-xs">{getTypeLabel()}</span>
              </div>
              
              <div className="hidden md:flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100" title="Дата создания">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>{new Date(task.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
              
              {task.due_date && (
                <div className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded border ${isOverdue ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 border-slate-100'}`} title="Срок выполнения">
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
                <div className="flex items-center gap-1 bg-blue-50 px-1.5 md:px-2 py-0.5 rounded text-blue-700 border border-blue-100">
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
}