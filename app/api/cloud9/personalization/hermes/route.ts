import { getCurrentUser } from "@/lib/auth"
import { isAdminRequest } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Hermes persona (SOUL.md) and built-in memory (MEMORY.md / USER.md), through
// the dashboard API. Both are agent-global, and memory holds what the agent
// learned about the owner, so reads are admin-only too. Memory is read-only:
// the agent writes it.

const bad = (error: string, status: number) => NextResponse.json({ error }, { status })

async function guard() {
  if (!(await getCurrentUser())) return bad("Unauthorized", 401)
  if (!(await isAdminRequest())) return bad("Only admins can change agent settings", 403)
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied

  const [soul, memory] = await Promise.all([dashboard.soul(), dashboard.memory()])
  if (!soul.ok) return bad(soul.error, soul.status || 502)
  if (!memory.ok) return bad(memory.error, memory.status || 502)

  return NextResponse.json({ soul: soul.data.content, entries: memory.data.memory ?? [] })
}

// { soul } writes SOUL.md.
export async function PUT(request: Request) {
  const denied = await guard()
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as { soul?: unknown }
  if (typeof body.soul !== "string") return bad("soul is required", 400)

  const res = await dashboard.updateSoul(body.soul)
  if (!res.ok) return bad(res.error, res.status || 502)
  return NextResponse.json({ ok: true })
}
