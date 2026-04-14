// Push Notifications Utility using Web Notifications API

export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Request permission to show browser notifications
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      // Try the promise-based API first (modern browsers)
      const permission = await Notification.requestPermission();
      return permission as NotificationPermission;
    } catch (error) {
      return 'denied';
    }
  }

  return Notification.permission as NotificationPermission;
};

/**
 * Check if notifications are supported and enabled
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as NotificationPermission;
};

/**
 * Show a browser push notification
 */
export const showPushNotification = (
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    silent?: boolean;
  }
): Notification | null => {
  if (!isNotificationSupported()) {
    return null;
  }
  
  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/favicon.ico',
      badge: options?.badge || '/favicon.ico',
      tag: options?.tag || `notification-${Date.now()}`,
      data: options?.data || {},
      requireInteraction: options?.requireInteraction || false,
      silent: options?.silent || false,
    });

    // Auto-close after 5 seconds if not requiring interaction
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }

    return notification;
  } catch (error) {
    return null;
  }
};

/**
 * Show notification for a CRM notification object
 */
export const showCRMNotification = (
  notification: {
    id: string;
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    actionUrl?: string | null;
  }
) => {
  const iconMap = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️',
  };

  const icon = iconMap[notification.type] || 'ℹ️';
  const requireInteraction = notification.priority === 'high';

  const pushNotif = showPushNotification(
    `${icon} ${notification.title}`,
    {
      body: notification.message,
      tag: notification.id,
      data: {
        notificationId: notification.id,
        actionUrl: notification.actionUrl,
      },
      requireInteraction,
    }
  );

  // Handle click on notification
  if (pushNotif && notification.actionUrl) {
    pushNotif.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
      pushNotif.close();
    };
  }

  return pushNotif;
};

/**
 * Store notification preference in localStorage
 */
export const setNotificationPreference = (enabled: boolean) => {
  localStorage.setItem('pushNotificationsEnabled', enabled ? 'true' : 'false');
};

/**
 * Get notification preference from localStorage
 */
export const getNotificationPreference = (): boolean => {
  const preference = localStorage.getItem('pushNotificationsEnabled');
  return preference !== 'false'; // Default to true
};
