import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Spawns a background install on the dashboard; the caller polls by
// refetching the Yours list rather than waiting on this response.

export async function POST(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { identifier } = (await request.json()) as { identifier?: string }
  if (!identifier?.trim()) {
    return NextResponse.json({ error: "identifier is required" }, { status: 400 })
  }
  const res = await dashboard.installHubSkill(identifier.trim())
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
