import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';
const ls = () => (typeof localStorage === 'undefined' ? null : localStorage);

export async function getSecret(key: string): Promise<string | null> {
  if (isWeb) return ls()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
export async function setSecret(key: string, value: string): Promise<void> {
  if (isWeb) ls()?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
export async function delSecret(key: string): Promise<void> {
  if (isWeb) ls()?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await getSecret(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export function setJSON(key: string, value: unknown): Promise<void> {
  return setSecret(key, JSON.stringify(value));
}
