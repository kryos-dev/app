import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextRequest, NextResponse } from "next/server"

// OAuth login for an MCP server (hermes_cli/web_routers/mcp.py:194). Hermes
// runs the flow itself and hands back an authorization URL for a browser to
// visit; the provider redirects to the dashboard's own callback, so nothing
// here has to see a token. POST starts a flow, GET polls one.

export async function POST(request: NextRequest) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const res = await dashboard.startMcpAuth(name)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}

export async function GET(request: NextRequest) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const flow = request.nextUrl.searchParams.get("flow")
  if (!flow) return NextResponse.json({ error: "flow is required" }, { status: 400 })

  const res = await dashboard.mcpAuthFlow(flow)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
