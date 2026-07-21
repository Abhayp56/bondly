import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export async function requestAppNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (e) {
      console.warn('Capacitor notification request error:', e);
      return false;
    }
  } else if ('Notification' in window) {
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (e) {
      return false;
    }
  }
  return false;
}

export async function sendAppNotification(title: string, body: string, id: number = Math.floor(Math.random() * 100000)) {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: id,
            schedule: { at: new Date(Date.now() + 100) },
            smallIcon: 'ic_stat_icon_config_sample',
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } catch (e) {
      console.warn('Capacitor local notification dispatch failed:', e);
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico'
      });
    } catch (e) {
      console.warn('Web Notification dispatch failed:', e);
    }
  }
}
