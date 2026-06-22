export type NotificationTone = 'info' | 'success' | 'error';

export interface AppNotification {
  title: string;
  message: string;
  tone?: NotificationTone;
  browser?: boolean;
  tag?: string;
}

export class NotificationService {
  public static readonly EVENT_NAME = 'hsss:notification';
  private static notificationsEnabled = false;

  public static init(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }

  public static isSupported(): boolean {
    return 'Notification' in window;
  }

  public static isEnabled(): boolean {
    return NotificationService.notificationsEnabled && Notification.permission === 'granted';
  }

  public static async requestPermission(): Promise<boolean> {
    if (!NotificationService.isSupported()) {
      NotificationService.notify({
        title: 'Notificaciones no disponibles',
        message: 'Este navegador no permite notificaciones.',
        tone: 'error'
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    const isGranted = permission === 'granted';
    NotificationService.notificationsEnabled = isGranted;

    NotificationService.notify({
      title: isGranted ? 'Notificaciones activas' : 'Permiso no concedido',
      message: isGranted ? 'Te avisaremos de las confirmaciones importantes.' : 'Puedes activarlas mas tarde desde el navegador.',
      tone: isGranted ? 'success' : 'error',
      browser: isGranted,
      tag: 'notifications-enabled'
    });

    return isGranted;
  }

  public static notify(notification: AppNotification): void {
    window.dispatchEvent(new CustomEvent(NotificationService.EVENT_NAME, {
      detail: {
        ...notification,
        tone: notification.tone ?? 'info'
      }
    }));

    if (notification.browser) {
      void NotificationService.showBrowserNotification(notification);
    }
  }

  private static async showBrowserNotification(notification: AppNotification): Promise<void> {
    if (!NotificationService.isEnabled()) {
      return;
    }

    const options: NotificationOptions = {
      body: notification.message,
      tag: notification.tag,
      icon: '/favicon.svg',
      badge: '/favicon.svg'
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title, options);
      return;
    }

    new Notification(notification.title, options);
  }
}
