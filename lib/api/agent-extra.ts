import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ApiError, request } from './http';
import * as dash from './dashboard';
import type { McpFlow } from '../types';

// Helpers shared by the Agent screens. Contracts: .claude/docs/hermes-client-contracts.md

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as { detail?: unknown; error?: unknown } | string | null;
    const d = typeof b === 'string' ? b : b?.detail ?? b?.error;
    return `${e.status}${d ? ': ' + (typeof d === 'string' ? d : JSON.stringify(d)) : ''}`;
  }
  return e instanceof Error ? e.message : String(e);
}

export const show = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v, null, 2));

// Typed routes are generated at build time; dynamic hrefs are passed as plain strings.
export function useGo() {
  const r = useRouter();
  return (path: string) => r.push(path as never);
}

export async function openExternal(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else await WebBrowser.openBrowserAsync(url);
}

// contracts 4: GET /api/skills/hub/preview
export const hubPreview = (identifier: string) =>
  request<{ name: string; description: string; trust_level: string; skill_md?: string; files?: unknown }>('dashboard', '/api/skills/hub/preview', {
    query: { identifier },
  });

// GET /api/cron/delivery-targets
export const deliveryTargets = () =>
  request<{ targets: { id: string; name: string; home_target_set: boolean; home_env_var: string }[] }>('dashboard', '/api/cron/delivery-targets');

// Background actions (hub install etc.): poll status until it stops running. contracts 8.
export async function waitAction(name: string, tries = 60): Promise<{ exit_code: number | null; lines: string[] }> {
  for (let i = 0; i < tries; i++) {
    const s = await dash.actionStatus(name, 50);
    if (!s.running) return { exit_code: s.exit_code, lines: s.lines };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { exit_code: null, lines: ['timed out waiting for action'] };
}

// contracts 5 "OAuth flow, step by step": start, open URL, poll up to 15 min (TTL 900 s).
export async function runOAuth(name: string, cancelled: () => boolean, onFlow?: (f: McpFlow) => void): Promise<McpFlow> {
  let flow = await dash.mcp.startAuth(name);
  onFlow?.(flow);
  let opened = false;
  const open = async () => {
    if (!opened && flow.authorization_url) {
      opened = true;
      await openExternal(flow.authorization_url);
    }
  };
  await open();
  const end = Date.now() + 15 * 60 * 1000;
  while (flow.status !== 'approved' && flow.status !== 'error' && Date.now() < end) {
    if (cancelled()) break;
    await new Promise((r) => setTimeout(r, 2000));
    flow = await dash.mcp.getFlow(flow.flow_id);
    onFlow?.(flow);
    await open();
  }
  if (flow.status !== 'approved' && flow.status !== 'error') {
    flow = { ...flow, status: 'error', error: cancelled() ? 'cancelled' : 'timed out after 15 min' };
    dash.mcp.deleteFlow(flow.flow_id).catch(() => {});
  }
  return flow;
}
