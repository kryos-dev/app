import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status: status || 502 })

// GET: run history of one job.
export async function GET(_request: Request, { params }: Params) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const res = await dashboard.cronJobRuns(id)
  if (!res.ok) return fail(res.error, res.status)
  return NextResponse.json({ runs: res.data.runs ?? [] })
}

// POST { action: pause | resume | run }
export async function POST(request: Request, { params }: Params) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const { action } = await request.json().catch(() => ({}))
  if (action !== "pause" && action !== "resume" && action !== "run") {
    return NextResponse.json({ error: "action must be pause, resume, or run" }, { status: 400 })
  }

  const res = await dashboard.cronJobAction(id, action === "run" ? "trigger" : action)
  if (!res.ok) return fail(res.error, res.status)
  return NextResponse.json(res.data ?? { ok: true })
}

export async function PUT(request: Request, { params }: Params) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const body = await request.json().catch(() => null)

  // Only the fields the edit dialog offers; Hermes validates execution fields
  // against the merged job, so a stray key would fail late and confusingly.
  const updates: Record<string, unknown> = {}
  for (const key of ["name", "schedule", "prompt", "deliver"] as const) {
    if (typeof body?.[key] === "string" && body[key].trim()) {
      updates[key] = body[key].trim()
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 })
  }

  const res = await dashboard.updateCronJob(id, updates)
  if (!res.ok) return fail(res.error, res.status)
  return NextResponse.json(res.data ?? { ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const res = await dashboard.deleteCronJob(id)
  if (!res.ok) return fail(res.error, res.status)
  return NextResponse.json({ ok: true })
}
