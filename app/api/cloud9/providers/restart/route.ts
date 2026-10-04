import { requireAdmin } from "@/lib/auth/guards"
import { fetchJson } from "@/lib/cloud9/fetch-json"
import { NextResponse } from "next/server"
import { dashboardJson as dashboardFetch } from "@/lib/cloud9/dashboard"

// POST restarts the Hermes gateway (actions.py, backgrounded). GET reports
// whether the gateway answers /health, which the page polls until it is back.

export async function POST() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const res = await dashboardFetch("/api/gateway/restart", { method: "POST" })
  return res.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: res.error }, { status: res.status || 502 })
}

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const base = process.env.HERMES_API_URL || ""
  const res = await fetchJson(`${base}/health`, undefined, 3000)
  return NextResponse.json({ up: base !== "" && res.ok })
}
