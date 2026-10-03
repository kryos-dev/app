import { setGatewayKey } from './http';
import { logout } from './dashboard';
import { health } from './gateway';

// Dashboard logout, then drop every stored secret. Logout errors are ignored so local state is always cleared.
export async function signOut(): Promise<void> {
  await logout().catch(() => {});
  await setGatewayKey(null);
}

// Poll gateway /health until 200. Waits first so the old process going down is not mistaken for up.
export async function waitForGateway(onTick: (secs: number) => void, timeoutMs = 90_000): Promise<boolean> {
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 3000));
  while (Date.now() - t0 < timeoutMs) {
    onTick(Math.round((Date.now() - t0) / 1000));
    try {
      await health();
      return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export function errText(e: unknown): string {
  const b = (e as { body?: { detail?: unknown } })?.body;
  if (typeof b?.detail === 'string') return b.detail;
  const st = (e as { status?: number })?.status;
  return st ? `Request failed (${st})` : e instanceof Error ? e.message : 'Something went wrong';
}
