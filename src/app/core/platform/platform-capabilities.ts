import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

export const DRIVER_TRANSPORT_ENABLED =
  environment.enableDriverTransport && Capacitor.getPlatform() === 'android';
