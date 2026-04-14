import { crm } from "@/lib/crmClient.ts";
import { showPushNotification } from './pushNotifications';

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  type: 'call' | 'meeting' | 'email' | 'task';
}

/**
 * Check for upcoming tasks and send notifications
 */
export const checkUpcomingTasks = async (): Promise<void> => {
  try {
    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Get tasks due soon (within 30 minutes or overdue)
    const { data: urgentTasks } = await crm
      .from('tasks')
      .select('id, title, due_date, priority, type')
      .eq('status', 'planned')
      .lte('due_date', in30Minutes.toISOString());

    // Get tasks due today (not yet notified)
    const { data: todayTasks } = await crm
      .from('tasks')
      .select('id, title, due_date, priority, type')
      .eq('status', 'planned')
      .gte('due_date', now.toISOString())
      .lte('due_date', today.toISOString());

    // Show notifications for urgent tasks
    if (urgentTasks && urgentTasks.length > 0) {
      urgentTasks.forEach((task: Task) => {
        const taskDate = new Date(task.due_date);
        const isOverdue = taskDate < now;
        const minutesUntil = Math.floor((taskDate.getTime() - now.getTime()) / 1000 / 60);

        let message = '';
        if (isOverdue) {
          message = `Задача просрочена! Дедлайн был ${taskDate.toLocaleString('ru-RU')}`;
        } else if (minutesUntil <= 5) {
          message = `Задача начинается через ${minutesUntil} мин!`;
        } else if (minutesUntil <= 30) {
          message = `Задача начинается через ${minutesUntil} мин`;
        }

        const emoji = getTaskEmoji(task.type);

        showPushNotification(`${emoji} ${task.title}`, {
          body: message,
          tag: `task-${task.id}`,
          requireInteraction: isOverdue || minutesUntil <= 5,
          data: {
            taskId: task.id,
            actionUrl: '/tasks',
          },
        });
      });
    }

    // Store notification check timestamp
    localStorage.setItem('lastTaskNotificationCheck', now.toISOString());
  } catch (error) {
    console.error('Error checking upcoming tasks:', error);
  }
};

/**
 * Get emoji for task type
 */
const getTaskEmoji = (type: string): string => {
  switch (type) {
    case 'call':
      return '📞';
    case 'meeting':
      return '👥';
    case 'email':
      return '✉️';
    default:
      return '✓';
  }
};

/**
 * Start periodic task notifications check
 */
export const startTaskNotifications = (intervalMinutes: number = 10): NodeJS.Timeout | null => {
  // Check if notifications are enabled
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  // Initial check
  checkUpcomingTasks();

  // Set up periodic checks
  const interval = setInterval(() => {
    checkUpcomingTasks();
  }, intervalMinutes * 60 * 1000);

  return interval;
};

/**
 * Stop task notifications
 */
export const stopTaskNotifications = (interval: NodeJS.Timeout | null): void => {
  if (interval) {
    clearInterval(interval);
  }
};

/**
 * Check if enough time has passed since last notification
 */
export const shouldCheckNotifications = (minutesSinceLastCheck: number = 10): boolean => {
  const lastCheck = localStorage.getItem('lastTaskNotificationCheck');
  if (!lastCheck) return true;

  const lastCheckDate = new Date(lastCheck);
  const now = new Date();
  const minutesPassed = (now.getTime() - lastCheckDate.getTime()) / 1000 / 60;

  return minutesPassed >= minutesSinceLastCheck;
};
