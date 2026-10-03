import { request, streamRequest } from './http';
import { parseSse } from './sse';
import type { ListEnvelope, Message, ResponsesRequest, Session, SseEvent } from '../types';

// Gateway API server: Bearer API_SERVER_KEY (contracts 2, 3.1).
const enc = encodeURIComponent;

export const health = () => request<{ status: string; platform?: string; version?: string }>('gateway', '/health');
export const models = () => request<{ object: 'list'; data: { id: string }[] }>('gateway', '/v1/models');

export const sessions = {
  list: (q: { limit?: number; offset?: number; source?: string; title?: string } = {}) =>
    request<ListEnvelope<Session>>('gateway', '/api/sessions', { query: q }),
  get: (id: string) => request<{ object: 'hermes.session'; session: Session }>('gateway', `/api/sessions/${enc(id)}`),
  messages: (id: string, q: { limit?: number; offset?: number; order?: 'oldest' | 'latest' } = {}) =>
    request<{ object: 'list'; session_id: string; data: Message[] }>('gateway', `/api/sessions/${enc(id)}/messages`, { query: q }),
  rename: (id: string, title: string | null) =>
    request<{ session: Session }>('gateway', `/api/sessions/${enc(id)}`, { method: 'PATCH', body: { title } }),
  delete: (id: string) => request<{ id: string; deleted: boolean }>('gateway', `/api/sessions/${enc(id)}`, { method: 'DELETE' }),
  fork: (id: string, title?: string) =>
    request<{ session: Session }>('gateway', `/api/sessions/${enc(id)}/fork`, { method: 'POST', body: { title } }),
};

export interface CreateResponseOpts {
  sessionId?: string;
  // TODO: X-Hermes-Session-Key is not in the API CORS allow list (contracts 1.5); browsers may be blocked.
  sessionKey?: string;
  signal?: AbortSignal;
}

// POST /v1/responses with stream:true. sessionId is read from the X-Hermes-Session-Id response header (contracts 2.2).
export async function createResponse(
  req: ResponsesRequest,
  o: CreateResponseOpts = {},
): Promise<{ sessionId: string | null; events: AsyncGenerator<SseEvent> }> {
  const headers: Record<string, string> = {};
  if (o.sessionId) headers['X-Hermes-Session-Id'] = o.sessionId;
  if (o.sessionKey) headers['X-Hermes-Session-Key'] = o.sessionKey;
  const res = await streamRequest('gateway', '/v1/responses', {
    method: 'POST',
    headers,
    signal: o.signal,
    body: { model: 'hermes-agent', stream: true, ...req },
  });
  return { sessionId: res.headers.get('X-Hermes-Session-Id'), events: parseSse(res) };
}
