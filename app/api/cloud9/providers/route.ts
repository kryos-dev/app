import { requireAdmin } from "@/lib/auth/guards"
import { NextResponse } from "next/server"
import { dashboardJson as dashboardFetch, jsonBody } from "@/lib/cloud9/dashboard"

// Env keys and OAuth providers, proxied to the Hermes dashboard
// (hermes_cli/web_routers/config_env.py, oauth.py). Values are passed straight
// through and never logged; the list only ever carries redacted previews.

const fail = (r: { status: number; error: string }) =>
  NextResponse.json({ error: r.error }, { status: r.status || 502 })

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const [env, oauth] = await Promise.all([
    dashboardFetch<Record<string, { is_set: boolean; redacted_value: string | null }>>("/api/env"),
    dashboardFetch<{ providers: unknown[] }>("/api/providers/oauth"),
  ])
  if (!env.ok) return fail(env)
  return NextResponse.json({
    env: Object.entries(env.data).map(([key, v]) => ({
      key,
      isSet: v.is_set,
      preview: v.redacted_value,
    })),
    oauth: oauth.ok ? oauth.data.providers : [],
  })
}

// Body: { entries: { KEY: "value", ... } }. A card with two keys saves both.
export async function PUT(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { entries } = (await request.json()) as { entries?: Record<string, string> }
  const pairs = Object.entries(entries ?? {}).filter(([k, v]) => k && typeof v === "string" && v)
  if (!pairs.length) return NextResponse.json({ error: "entries are required" }, { status: 400 })

  for (const [key, value] of pairs) {
    const res = await dashboardFetch("/api/env", jsonBody("PUT", { key, value }))
    if (!res.ok) return fail(res)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { key } = (await request.json()) as { key?: string }
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 })

  const res = await dashboardFetch("/api/env", jsonBody("DELETE", { key }))
  if (!res.ok) return fail(res)
  return NextResponse.json({ ok: true })
}
