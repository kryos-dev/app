import { requireAdmin } from "@/lib/auth/guards"
import { NextResponse } from "next/server"
import { dashboardJson as dashboardFetch } from "@/lib/cloud9/dashboard"

// Device-code login for a subscription provider (oauth.py): POST starts the
// flow, GET ?session= polls it, DELETE disconnects.

type Ctx = { params: Promise<{ id: string }> }
const fail = (r: { status: number; error: string }) =>
  NextResponse.json({ error: r.error }, { status: r.status || 502 })

export async function POST(_req: Request, { params }: Ctx) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied
  const { id } = await params

  const res = await dashboardFetch(`/api/providers/oauth/${encodeURIComponent(id)}/start`, {
    method: "POST",
  })
  return res.ok ? NextResponse.json(res.data) : fail(res)
}

export async function GET(request: Request, { params }: Ctx) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied
  const { id } = await params
  const session = new URL(request.url).searchParams.get("session")
  if (!session) return NextResponse.json({ error: "session is required" }, { status: 400 })

  const res = await dashboardFetch(
    `/api/providers/oauth/${encodeURIComponent(id)}/poll/${encodeURIComponent(session)}`
  )
  return res.ok ? NextResponse.json(res.data) : fail(res)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied
  const { id } = await params

  const res = await dashboardFetch(`/api/providers/oauth/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return res.ok ? NextResponse.json({ ok: true }) : fail(res)
}
