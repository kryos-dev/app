import { request } from './http';
import type {
  ActionStart,
  CronJob,
  CronJobCreate,
  EnvVar,
  HubSkill,
  McpFlow,
  McpServer,
  McpTestResult,
  MemoryProviderConfig,
  MemoryState,
  ModelOptionsResponse,
  Skill,
} from '../types';

// Dashboard API, cookie session (contracts 1, 4-8). Bodies match the doc exactly.
const d = <T>(path: string, o?: Parameters<typeof request>[2]) => request<T>('dashboard', path, o);
const enc = encodeURIComponent;
const post = <T>(path: string, body?: unknown) => d<T>(path, { method: 'POST', body: body ?? {} });
const put = <T>(path: string, body: unknown) => d<T>(path, { method: 'PUT', body });
const del = <T>(path: string, body?: unknown) => d<T>(path, { method: 'DELETE', body });

export interface AuthProvider {
  name: string;
  display_name: string;
  supports_password: boolean;
}
export interface Me {
  user_id: string;
  email?: string;
  display_name?: string;
  org_id?: string;
  provider?: string;
  expires_at?: number;
}

export const providers = () => d<{ providers: AuthProvider[] }>('/api/auth/providers');
export const passwordLogin = (username: string, password: string, provider: string) =>
  post<{ ok: boolean; next?: string }>('/auth/password-login', { provider, username, password });
export const me = () => d<Me>('/api/auth/me');
// Cookie logout; the 302 to /login is followed by fetch and ignored.
export const logout = () => post<unknown>('/auth/logout');

export const status = () => d<unknown>('/api/status');
export const listEnv = () => d<Record<string, EnvVar>>('/api/env');
export const setEnv = (key: string, value: string) => put<{ ok: boolean; key: string }>('/api/env', { key, value });
export const deleteEnv = (key: string) => del<{ ok: boolean; found: boolean; key: string }>('/api/env', { key });
// Limited to 5 reveals per 30 s (contracts 8).
export const revealEnv = (key: string) => post<{ key: string; value: string }>('/api/env/reveal', { key });
export const gatewayRestart = () => post<{ ok: boolean; pid: number; name: string }>('/api/gateway/restart');
export const actionStatus = (name: string, lines = 200) =>
  d<{ name: string; running: boolean; exit_code: number | null; lines: string[] }>(`/api/actions/${enc(name)}/status`, {
    query: { lines },
  });

export const skills = {
  list: () => d<Skill[]>('/api/skills'),
  toggle: (name: string, enabled: boolean) => put<{ ok: boolean }>('/api/skills/toggle', { name, enabled }),
  getContent: (name: string) => d<{ name: string; content: string; path: string }>('/api/skills/content', { query: { name } }),
  putContent: (name: string, content: string) => put<{ success: boolean; error?: string }>('/api/skills/content', { name, content }),
  create: (name: string, content: string, category?: string) =>
    post<{ success: boolean; error?: string }>('/api/skills', { name, content, category }),
  hubSearch: (q?: string, source?: string, limit?: number) =>
    d<{ results: HubSkill[]; installed?: unknown }>('/api/skills/hub/search', { query: { q, source, limit } }),
  hubInstall: (identifier: string) => post<ActionStart>('/api/skills/hub/install', { identifier }),
  hubUninstall: (name: string) => post<ActionStart>('/api/skills/hub/uninstall', { name }),
};

export const mcp = {
  list: () => d<{ servers: McpServer[] }>('/api/mcp/servers'),
  create: (s: { name: string; url?: string; command?: string; args?: string[]; env?: Record<string, string>; auth?: string; bearer_token?: string }) =>
    post<McpServer>('/api/mcp/servers', { args: [], env: {}, ...s }),
  delete: (name: string) => del<{ ok: boolean }>(`/api/mcp/servers/${enc(name)}`),
  test: (name: string) => post<McpTestResult>(`/api/mcp/servers/${enc(name)}/test`),
  setEnabled: (name: string, enabled: boolean) =>
    put<{ ok: boolean; name: string; enabled: boolean }>(`/api/mcp/servers/${enc(name)}/enabled`, { enabled }),
  startAuth: (name: string) => post<McpFlow>(`/api/mcp/servers/${enc(name)}/auth`),
  getFlow: (flowId: string) => d<McpFlow>(`/api/mcp/oauth/flows/${enc(flowId)}`),
  deleteFlow: (flowId: string) => del<{ ok: boolean; status: string }>(`/api/mcp/oauth/flows/${enc(flowId)}`),
  // Catalog entry shape is only in source (mcp.py:439), so entries stay loose.
  catalog: () => d<{ entries: Record<string, unknown>[]; diagnostics: unknown[] }>('/api/mcp/catalog'),
  catalogInstall: (name: string, env: Record<string, string> = {}, enable = true) =>
    post<{ ok: boolean; name: string; background: boolean; action?: string }>('/api/mcp/catalog/install', { name, env, enable }),
};

// GET /api/cron/jobs returns a bare array; update wraps the partial body as { updates }.
export const cron = {
  list: async (): Promise<CronJob[]> => {
    const r = await d<CronJob[] | { jobs?: CronJob[] }>('/api/cron/jobs');
    return Array.isArray(r) ? r : r.jobs ?? [];
  },
  get: (id: string) => d<CronJob>(`/api/cron/jobs/${enc(id)}`),
  runs: (id: string, limit = 20) => d<{ runs: Record<string, unknown>[]; limit: number }>(`/api/cron/jobs/${enc(id)}/runs`, { query: { limit } }),
  create: (body: CronJobCreate) => post<CronJob>('/api/cron/jobs', body),
  update: (id: string, updates: Partial<CronJobCreate>) => put<CronJob>(`/api/cron/jobs/${enc(id)}`, { updates }),
  delete: (id: string) => del<{ ok: boolean }>(`/api/cron/jobs/${enc(id)}`),
  pause: (id: string) => post<CronJob>(`/api/cron/jobs/${enc(id)}/pause`),
  resume: (id: string) => post<CronJob>(`/api/cron/jobs/${enc(id)}/resume`),
  trigger: (id: string) => post<CronJob>(`/api/cron/jobs/${enc(id)}/trigger`),
};

export const memory = {
  get: () => d<MemoryState>('/api/memory'),
  setProvider: (provider: string) => put<{ ok: boolean; active: string }>('/api/memory/provider', { provider }),
  reset: (target: 'all' | 'memory' | 'user') => post<{ ok: boolean; deleted: unknown }>('/api/memory/reset', { target }),
  providerConfig: {
    get: (name: string) => d<MemoryProviderConfig>(`/api/memory/providers/${enc(name)}/config`),
    put: (name: string, values: Record<string, unknown>) =>
      put<{ ok: boolean; active: string }>(`/api/memory/providers/${enc(name)}/config`, { values }),
  },
};

export const model = {
  info: () => d<Record<string, unknown>>('/api/model/info'),
  options: () => d<ModelOptionsResponse>('/api/model/options'),
  set: (b: { provider: string; model: string; reasoning_effort?: string; confirm_expensive_model?: boolean }) =>
    post<{ ok: boolean; confirm_required?: boolean; confirm_message?: string }>('/api/model/set', {
      scope: 'main',
      confirm_expensive_model: false,
      ...b,
    }),
};

// Provider sign-in routes (device-code flow); the server owns all state, the client only starts and polls.
export interface OauthProvider {
  id: string;
  name: string;
  flow: string;
  cli_command?: string;
  disconnect_command?: string | null;
  disconnect_hint?: string | null;
  disconnectable: boolean;
  status: { logged_in: boolean; source_label?: string; token_preview?: string | null; expires_at?: string | null };
}
export interface OauthStart {
  session_id: string;
  flow: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  poll_interval: number;
}
export type OauthPollStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'error' | 'cancelled';
export const providerOauth = {
  list: () => d<{ providers: OauthProvider[] }>('/api/providers/oauth'),
  start: (id: string) => post<OauthStart>(`/api/providers/oauth/${enc(id)}/start`),
  poll: (id: string, sessionId: string) =>
    d<{ session_id: string; status: OauthPollStatus; error_message?: string | null }>(
      `/api/providers/oauth/${enc(id)}/poll/${enc(sessionId)}`,
    ),
  disconnect: (id: string) => del<{ ok: boolean }>(`/api/providers/oauth/${enc(id)}`),
};
