// Ponte verso le funzioni native quando l'app gira dentro Capacitor (iOS/Android):
// vibrazioni e notifiche locali (anche ad app chiusa). I sensori di orientamento usano
// direttamente gli eventi della WebView (bussola vera su iOS, orientamento assoluto su Android).
// Sul web ogni funzione restituisce false/null e l'app usa le API del browser.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';

const isNative = Capacitor.isNativePlatform();

export interface NativeNotification { id: number; title: string; body: string; at: Date }

export const native = {
  isNative,
  platform: Capacitor.getPlatform(),
  /** Vibrazione nativa (Taptic Engine / Android); false se non disponibile. */
  haptic(kind: 'light' | 'medium' | 'success'): boolean {
    if (!isNative) return false;
    if (kind === 'success') Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
    return true;
  },
  /** Notifiche locali programmate dal sistema: arrivano anche con l'app chiusa. */
  async schedule(list: NativeNotification[]): Promise<boolean> {
    if (!isNative) return false;
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      await LocalNotifications.schedule({ notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })) });
      return true;
    } catch { return false; }
  },
  /** Posizione dal GPS. Nell'app nativa usa il permesso di sistema (col nome «Vastity», non «localhost»). */
  async position(): Promise<{ lat: number; lon: number; alt: number } | null> {
    try {
      if (isNative) {
        const p = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') return null;
        const c = (await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 })).coords;
        return { lat: c.latitude, lon: c.longitude, alt: c.altitude ?? 0 };
      }
      if (!navigator.geolocation) return null;
      return await new Promise((res) => navigator.geolocation.getCurrentPosition(
        (q) => res({ lat: q.coords.latitude, lon: q.coords.longitude, alt: q.coords.altitude ?? 0 }), () => res(null),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }));
    } catch { return null; }
  },
  /** Permesso per le notifiche (promemoria di eclissi e passaggi della ISS). */
  async notificationsPermission(): Promise<boolean> {
    try {
      if (isNative) return (await LocalNotifications.requestPermissions()).display === 'granted';
      if (!('Notification' in window)) return false;
      return (await Notification.requestPermission()) === 'granted';
    } catch { return false; }
  },
};
