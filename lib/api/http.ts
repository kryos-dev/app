import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { getSecret, setSecret, delSecret } from '../storage';
import { getSettings } from '../config';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

// auth-expired event: root layout subscribes and routes to sign-in.
const listeners = new Set<() => void>();
export function onAuthExpired(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const emitAuthExpired = () => listeners.forEach((fn) => fn());

const GW_KEY = 'kryos.gatewayKey';
const OC_PW = 'kryos.opencodePassword';
let gatewayKey: string | null = null;

export async function loadGatewayKey(): Promise<string | null> {
  gatewayKey = await getSecret(GW_KEY);
  return gatewayKey;
}
export const getGatewayKey = () => gatewayKey;
export async function setGatewayKey(k: string | null): Promise<void> {
  gatewayKey = k;
  if (k) await setSecret(GW_KEY, k);
  else await delSecret(GW_KEY);
}
export const getOpencodePassword = () => getSecret(OC_PW);
export const setOpencodePassword = (p: string) => setSecret(OC_PW, p);

export type Kind = 'dashboard' | 'gateway' | 'opencode';

export interface ReqOpts {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function baseFor(kind: Kind): string {
  const s = getSettings();
  return kind === 'dashboard' ? s.dashboardBase : kind === 'gateway' ? s.gatewayBase : s.opencodeBase;
}

export function buildUrl(kind: Kind, path: string, query?: ReqOpts['query']): string {
  let url = baseFor(kind) + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

export async function buildInit(kind: Kind, o: ReqOpts): Promise<RequestInit> {
  const headers: Record<string, string> = { Accept: 'application/json', ...o.headers };
  const init: RequestInit = { method: o.method ?? 'GET', headers, signal: o.signal };
  if (o.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(o.body);
  }
  if (kind === 'dashboard') {
    init.credentials = 'include';
  } else if (kind === 'gateway') {
    if (gatewayKey) headers.Authorization = `Bearer ${gatewayKey}`;
  } else {
    const pw = (await getOpencodePassword()) ?? '';
    headers.Authorization = `Basic ${btoa(`opencode:${pw}`)}`;
  }
  return init;
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(kind: Kind, path: string, o: ReqOpts = {}): Promise<T> {
  const res = await fetch(buildUrl(kind, path, o.query), await buildInit(kind, o));
  const body = await parse(res);
  if (!res.ok) {
    if (res.status === 401 && kind === 'dashboard') emitAuthExpired();
    throw new ApiError(res.status, body);
  }
  return body as T;
}

// Streaming fetch: expo/fetch on native (streaming bodies), global fetch on web.
export async function streamRequest(kind: Kind, path: string, o: ReqOpts = {}): Promise<Response> {
  const init = await buildInit(kind, o);
  (init.headers as Record<string, string>).Accept = 'text/event-stream';
  const f = (Platform.OS === 'web' ? fetch : expoFetch) as unknown as typeof fetch;
  const res = await f(buildUrl(kind, path, o.query), init);
  if (!res.ok) {
    const body = await parse(res);
    throw new ApiError(res.status, body);
  }
  return res;
}
