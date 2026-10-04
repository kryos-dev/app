// Server-side client for the Hermes dashboard admin API.
// The dashboard's "basic" auth provider has no API tokens: it issues signed session
// cookies from POST /auth/password-login. We log in with HERMES_DASHBOARD_USER /
// HERMES_DASHBOARD_PASSWORD, keep the cookies in memory and re-login once on 401.
// When creds are missing or the host is unreachable, callers get ok:false so pages
// render a "connect the dashboard" state instead of crashing.
//
// Paths, methods and bodies are read from hermes_cli/web_routers/{mcp,cron,skills,
// tools,models,profiles,status}.py and web_models.py.
import { fetchJson, type JsonResult } from "./fetch-json"

const BASE = process.env.HERMES_DASHBOARD_URL || ""
const USER = process.env.HERMES_DASHBOARD_USER || ""
const PASSWORD = process.env.HERMES_DASHBOARD_PASSWORD || ""

// ponytail: one cookie jar per server process; fine for a single-operator app.
let cookieJar = ""

export const dashboardConfigured = BASE.length > 0 && USER.length > 0 && PASSWORD.length > 0

const NOT_CONFIGURED =
  "HERMES_DASHBOARD_URL / HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD are not configured"

async function login(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "basic", username: USER, password: PASSWORD }),
    cache: "no-store",
    redirect: "manual",
  }).catch(() => null)
  const setCookies = res?.headers.getSetCookie?.() ?? []
  if (!setCookies.length) return false
  cookieJar = setCookies.map((c) => c.split(";")[0]).join("; ")
  return true
}

// Authenticated raw fetch: cookie login, one re-login on 401. Throws when
// credentials are missing or login fails.
export async function dashboardFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!dashboardConfigured) throw new Error(NOT_CONFIGURED)
  if (!cookieJar && !(await login())) throw new Error("Dashboard login failed")
  const send = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Cookie: cookieJar },
      cache: "no-store",
    })
  let res = await send()
  if (res.status === 401 && (await login())) res = await send()
  return res
}

export async function dashboardJson<T>(path: string, init: RequestInit = {}): Promise<JsonResult<T>> {
  if (!dashboardConfigured) return { ok: false, status: 401, error: NOT_CONFIGURED }
  if (!cookieJar && !(await login())) {
    return { ok: false, status: 401, error: "Dashboard login failed" }
  }
  const withCookie = (): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string>), Cookie: cookieJar },
  })
  let res = await fetchJson<T>(`${BASE}${path}`, withCookie())
  if (!res.ok && res.status === 401 && (await login())) {
    res = await fetchJson<T>(`${BASE}${path}`, withCookie())
  }
  return res
}

export const jsonBody = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body !== undefined ? JSON.stringify(body) : undefined,
})
const get = <T,>(path: string) => dashboardJson<T>(path)
const post = <T,>(path: string, body?: unknown) => dashboardJson<T>(path, jsonBody("POST", body))
const put = <T,>(path: string, body?: unknown) => dashboardJson<T>(path, jsonBody("PUT", body))
const del = <T,>(path: string) => dashboardJson<T>(path, { method: "DELETE" })
const enc = encodeURIComponent

// web_server_mcp._mcp_server_summary
export type McpServer = {
  name: string
  enabled: boolean
  transport: string
  url?: string | null
  command?: string | null
  auth?: string | null
  source?: string
  plugin?: string | null
}

// Cron job dict from cron.jobs (the list route returns a bare array).
export type CronJob = {
  id: string
  name: string
  prompt?: string
  schedule_display: string
  deliver?: string
  enabled: boolean
  state?: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error?: string | null
}

// GET /api/cron/jobs/{id}/runs
export type CronRun = {
  id?: string
  title?: string | null
  started_at?: number | string | null
  ended_at?: number | string | null
  is_active?: boolean
}

// GET /api/cron/delivery-targets
export type DeliveryTarget = {
  id: string
  name: string
  home_target_set: boolean
  home_env_var: string | null
}

export type DashboardSkill = {
  name: string
  description?: string
  source?: string
  enabled?: boolean
  usage?: number
  // "hub" (installed from the hub), "bundled" (ships with Hermes), "external"
  // (mounted from skills.external_dirs) or "agent" (written here, by the agent
  // or by hand). Only the last kind is ours to edit.
  provenance?: "hub" | "bundled" | "external" | "agent"
  category?: string
}

// tools/mcp_dashboard_oauth.py DashboardOAuthFlow.snapshot()
export type McpAuthFlow = {
  flow_id: string
  server_name: string
  status: string
  authorization_url: string | null
  error: string | null
}

// mcp.py _catalog_entry_json
export type CatalogEntry = {
  name: string
  description?: string
  installed?: boolean
  enabled?: boolean
  transport?: string
  auth_type?: string
  required_env?: { name: string; prompt?: string; required?: boolean }[]
}

// GET /api/tools/toolsets (bare array)
export type Toolset = {
  name: string
  label: string
  description: string
  enabled: boolean
  configured: boolean
  tools: string[]
}

// Skills hub payload (skills.py _skill_meta_to_payload)
export type HubSkill = {
  name: string
  description?: string
  source?: string
  identifier?: string
  trust_level?: string
  repo?: string
  tags?: string[]
  category?: string
  installed?: boolean
}

// GET /api/model/options
export type ModelOptionsProvider = {
  slug: string
  name: string
  is_current?: boolean
  models?: string[]
  capabilities?: Record<string, { reasoning?: boolean }>
}

export const dashboard = {
  modelOptions: () => get<{ providers: ModelOptionsProvider[] }>("/api/model/options"),

  // Connectors (MCP servers).
  mcpServers: () => get<{ servers: McpServer[] }>("/api/mcp/servers"),
  addMcpServer: (body: Record<string, unknown>) => post("/api/mcp/servers", body),
  removeMcpServer: (name: string) => del(`/api/mcp/servers/${enc(name)}`),
  setMcpServerEnabled: (name: string, enabled: boolean) =>
    put(`/api/mcp/servers/${enc(name)}/enabled`, { enabled }),
  testMcpServer: (name: string) => post(`/api/mcp/servers/${enc(name)}/test`),
  // Hermes drives the OAuth flow and returns the URL a browser has to visit;
  // the provider redirects back to the dashboard's callback, not to this app.
  startMcpAuth: (name: string) => post<McpAuthFlow>(`/api/mcp/servers/${enc(name)}/auth`),
  mcpAuthFlow: (flowId: string) => get<McpAuthFlow>(`/api/mcp/oauth/flows/${enc(flowId)}`),
  listCatalog: () => get<{ entries: CatalogEntry[] }>("/api/mcp/catalog"),
  installCatalogEntry: (name: string, env: Record<string, string> = {}) =>
    post("/api/mcp/catalog/install", { name, env, enable: true }),

  // Toolsets: list and toggle both live on the dashboard.
  toolsets: () => get<Toolset[]>("/api/tools/toolsets"),
  toggleToolset: (name: string, enabled: boolean) =>
    put(`/api/tools/toolsets/${enc(name)}`, { enabled }),

  // Scheduled jobs. Update is PUT { updates }; "run now" is /trigger.
  cronJobs: () => get<CronJob[]>("/api/cron/jobs"),
  createCronJob: (body: Record<string, unknown>) => post<CronJob>("/api/cron/jobs", body),
  updateCronJob: (id: string, updates: Record<string, unknown>) =>
    put<CronJob>(`/api/cron/jobs/${enc(id)}`, { updates }),
  cronJobAction: (id: string, action: "pause" | "resume" | "trigger") =>
    post<CronJob>(`/api/cron/jobs/${enc(id)}/${action}`),
  cronJobRuns: (id: string, limit = 10) =>
    get<{ runs: CronRun[] }>(`/api/cron/jobs/${enc(id)}/runs?limit=${limit}`),
  deleteCronJob: (id: string) => del(`/api/cron/jobs/${enc(id)}`),
  deliveryTargets: () => get<{ targets: DeliveryTarget[] }>("/api/cron/delivery-targets"),

  // Skills. GET returns disabled skills too, so turning one off does not make
  // it vanish from the list.
  skills: () => get<DashboardSkill[]>("/api/skills"),
  toggleSkill: (name: string, enabled: boolean) =>
    put<{ ok: boolean }>("/api/skills/toggle", { name, enabled }),
  skillContent: (name: string) =>
    get<{ name: string; content: string; path: string }>(`/api/skills/content?name=${enc(name)}`),
  updateSkill: (name: string, content: string) =>
    put<{ success: boolean; error?: string }>("/api/skills/content", { name, content }),
  createSkill: (name: string, content: string, category?: string) =>
    post<{ success: boolean; error?: string }>("/api/skills", { name, content, category }),

  // Skills hub (Discover tab). Search needs a query; the official listing is
  // the whole optional-skills catalog.
  searchHubSkills: (q: string, source = "all", limit = 20) =>
    get<{ results: HubSkill[]; installed?: Record<string, unknown> }>(
      `/api/skills/hub/search?q=${enc(q)}&source=${enc(source)}&limit=${limit}`
    ),
  officialHubSkills: () => get<{ skills: HubSkill[] }>("/api/skills/hub/official"),
  // Install/uninstall spawn a background CLI action and return immediately.
  installHubSkill: (identifier: string) => post("/api/skills/hub/install", { identifier }),
  uninstallHubSkill: (name: string) => post("/api/skills/hub/uninstall", { name }),

  // Personalization. SOUL.md is the agent persona (the gateway runs the
  // "default" profile). Memory is read from the learning graph and never written.
  soul: () => get<{ content: string; exists: boolean }>("/api/profiles/default/soul"),
  updateSoul: (content: string) => put<{ ok: boolean }>("/api/profiles/default/soul", { content }),
  memory: () =>
    get<{ memory: { source: "memory" | "profile"; title: string; body: string }[] }>(
      "/api/learning/graph"
    ),
}

// FastAPI errors arrive as {detail}; surface that text.
export async function upstreamError(res: Response): Promise<string> {
  const raw = await res.text()
  try {
    const d = (JSON.parse(raw) as { detail?: unknown }).detail
    if (typeof d === "string") return d
  } catch {}
  return raw.slice(0, 300) || res.statusText
}
