import { request } from './http';

// OpenCode server, HTTP basic auth opencode:<password> (set via setOpencodePassword).
// getProviders is skipped: GET /config/providers is not in the contracts doc.
export const putAuth = (providerId: string, key: string) =>
  request<unknown>('opencode', `/auth/${encodeURIComponent(providerId)}`, { method: 'PUT', body: { type: 'api', key } });
