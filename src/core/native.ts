// Ponte verso le funzioni native quando l'app gira dentro Capacitor (iOS/Android):
// vibrazioni, notifiche locali (anche ad app chiusa) e sensori di orientamento.
// Sul web ogni funzione restituisce false/null e l'app usa le API del browser.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Motion } from '@capacitor/motion';

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
  /** Orientamento del telefono dai sensori nativi; restituisce la funzione per smettere o null sul web. */
  async orientation(cb: (alpha: number, beta: number, gamma: number) => void): Promise<(() => void) | null> {
    if (!isNative) return null;
    try {
      const h = await Motion.addListener('orientation', (e) => cb(e.alpha, e.beta, e.gamma));
      return () => { h.remove(); };
    } catch { return null; }
  },
};
