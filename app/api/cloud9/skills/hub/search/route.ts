import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Discover tab, typed-search path. Hermes searches every configured hub source
// and returns nothing for an empty query; the page uses the official list then.

export async function GET(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const params = new URL(request.url).searchParams
  const res = await dashboard.searchHubSkills(
    params.get("q") ?? "",
    params.get("source") || undefined,
    Number(params.get("limit")) || undefined
  )
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  const installed = res.data.installed ?? {}
  const skills = (res.data.results ?? []).map((s) => ({
    ...s,
    installed: !!s.identifier && s.identifier in installed,
  }))
  return NextResponse.json({ skills })
}
