import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Discover tab, default view (empty search box): the curated official list.

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const res = await dashboard.officialHubSkills()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
