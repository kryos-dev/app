import { requireAdmin } from "@/lib/auth/guards"
import { dashboard, dashboardConfigured } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Connectors: MCP servers and Hermes toolsets.
//
// This was a read-only page with a Test button. Every write below already
// existed in Hermes (hermes_cli/web_routers/mcp.py and tools.py) and simply was not wired up, so adding a connector meant
// editing config.yaml on the box by hand.
//
//   GET                                 servers + toolsets
//   POST   { name, command|url, ... }   add an MCP server
//   PUT    { name, enabled }            enable/disable an MCP server
//   PUT    { toolset, enabled }         enable/disable a toolset
//   DELETE ?name=                       remove an MCP server
//
// An MCP server that is disabled stays in the config; Hermes picks the change
// up on the next session rather than instantly, which the page says out loud.

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const [mcpRes, toolsetsRes] = await Promise.all([dashboard.mcpServers(), dashboard.toolsets()])

  return NextResponse.json({
    mcp: mcpRes.ok
      ? { servers: mcpRes.data.servers }
      : { error: mcpRes.error, configured: dashboardConfigured },
    toolsets: toolsetsRes.ok ? toolsetsRes.data : [],
    toolsetsError: toolsetsRes.ok ? null : toolsetsRes.error,
  })
}

export async function POST(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const body = (await request.json()) as {
    name?: string
    url?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!body.url?.trim() && !body.command?.trim()) {
    return NextResponse.json(
      { error: "Give either a url (remote server) or a command (stdio server)" },
      { status: 400 }
    )
  }

  const res = await dashboard.addMcpServer({
    name: body.name.trim(),
    url: body.url?.trim() || undefined,
    command: body.command?.trim() || undefined,
    args: body.args ?? [],
    env: body.env ?? {},
  })
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}

export async function PUT(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { name, toolset, enabled } = (await request.json()) as {
    name?: string
    toolset?: string
    enabled?: boolean
  }
  if (typeof enabled !== "boolean" || (!name && !toolset)) {
    return NextResponse.json(
      { error: "Send { name | toolset, enabled }" },
      { status: 400 }
    )
  }

  const res = toolset
    ? await dashboard.toggleToolset(toolset, enabled)
    : await dashboard.setMcpServerEnabled(name!, enabled)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}

export async function DELETE(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const name = new URL(request.url).searchParams.get("name")
  if (!name) return NextResponse.json({ error: "?name= is required" }, { status: 400 })

  const res = await dashboard.removeMcpServer(name)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
