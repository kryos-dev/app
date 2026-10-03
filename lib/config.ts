import { Platform } from 'react-native';
import { getJSON, setJSON } from './storage';

export interface Settings {
  dashboardBase: string;
  gatewayBase: string;
}

const SETTINGS_KEY = 'kryos.settings';

export function defaultSettings(): Settings {
  if (Platform.OS === 'web') {
    const o = typeof window === 'undefined' ? '' : window.location.origin;
    return { dashboardBase: o, gatewayBase: `${o}/gw` };
  }
  return {
    dashboardBase: 'https://hermes.kryos.dev',
    gatewayBase: 'https://api.kryos.dev/hermes',
  };
}

let current: Settings = defaultSettings();

export const getSettings = (): Settings => current;

export async function loadSettings(): Promise<Settings> {
  // Web always derives from origin; only native persists overrides.
  if (Platform.OS !== 'web') {
    const saved = await getJSON<Partial<Settings>>(SETTINGS_KEY);
    current = { ...defaultSettings(), ...saved };
  }
  return current;
}

export async function saveSettings(s: Settings): Promise<void> {
  current = { ...s, dashboardBase: trim(s.dashboardBase), gatewayBase: trim(s.gatewayBase) };
  if (Platform.OS !== 'web') await setJSON(SETTINGS_KEY, current);
}

const trim = (u: string) => u.trim().replace(/\/+$/, '');
