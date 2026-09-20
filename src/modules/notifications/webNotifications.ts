/**
 * Web Notification API Manager
 * Handles permission requests, service worker registration hooks, and local dispatch.
 */

export const webNotifications = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  },

  async showLocalNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            icon: '/icon.svg',
            badge: '/icon.svg',
            ...options,
          });
          return true;
        }
      }

      // Fallback
      new Notification(title, {
        icon: '/icon.svg',
        ...options,
      });
      return true;
    } catch (err) {
      console.warn('Notification failed:', err);
      return false;
    }
  },
};
