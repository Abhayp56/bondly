import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';

const PROMPT_HOURS = [8, 12, 16, 20, 22]; // 8 AM, 12 PM, 4 PM, 8 PM, 10 PM
const NOTIF_IDS = [1001, 1002, 1003, 1004, 1005];

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

// Single instant notification dispatcher
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
            smallIcon: 'ic_stat_heart',
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

// Scheduled daily questions manager: Schedules ONLY future, unanswered prompts for today
export async function syncDailyQuestionNotifications(questions: Array<{ answeredByUser?: boolean; unlockTime?: string }>) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Cancel previous pending daily prompt notifications to prevent duplication
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter(n => NOTIF_IDS.includes(n.id))
      .map(n => ({ id: n.id }));
    
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }

    const now = new Date();
    const notificationsToSchedule: LocalNotificationSchema[] = [];

    questions.forEach((q, idx) => {
      if (idx >= NOTIF_IDS.length) return;
      const notifId = NOTIF_IDS[idx];

      // If prompt is already answered by the user, DO NOT notify
      if (q.answeredByUser) return;

      // Determine target unlock time today
      let targetTime: Date;
      if (q.unlockTime) {
        targetTime = new Date(q.unlockTime);
      } else {
        targetTime = new Date();
        targetTime.setHours(PROMPT_HOURS[idx], 0, 0, 0);
      }

      // CRITICAL RULE: If the unlock time has ALREADY PASSED today, DO NOT schedule it!
      if (targetTime.getTime() <= now.getTime()) {
        return;
      }

      // Schedule ONLY for future unlock times today
      const timeLabel = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      notificationsToSchedule.push({
        title: `💖 Prompt ${idx + 1} Unlocked! (${timeLabel})`,
        body: `Your next daily question is ready! Tap to answer & sync with your partner.`,
        id: notifId,
        schedule: { at: targetTime, allowWhileIdle: true },
        smallIcon: 'ic_stat_heart',
        actionTypeId: '',
        extra: null
      });
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  } catch (e) {
    console.warn('Sync daily question notifications error:', e);
  }
}
