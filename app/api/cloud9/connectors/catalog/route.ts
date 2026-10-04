import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Connectors Discover tab. hermes_cli/web_routers/mcp.py catalog route.

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const res = await dashboard.listCatalog()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ catalog: res.data?.entries ?? [] })
}
