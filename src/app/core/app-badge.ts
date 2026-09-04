import { Capacitor, registerPlugin } from '@capacitor/core';

interface SeclifeBadgePlugin {
  setCount(options: { count: number }): Promise<void>;
}

const SeclifeBadge = registerPlugin<SeclifeBadgePlugin>('SeclifeBadge');

export async function setAppBadgeCount(count: number): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') {
    return;
  }

  await SeclifeBadge.setCount({ count: Math.max(0, Math.trunc(count)) });
}
