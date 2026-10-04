import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// Skills, read/write, proxied to the Hermes dashboard API.
//
// It was read-only until now: a list with a disabled Switch and a tooltip
// saying "Toggle from the Hermes dashboard", which is a page telling you to go
// use a different page. Hermes has had the write routes all along
// (hermes_cli/web_routers/skills.py at the pinned commit).
//
//   GET                      list, including disabled ones
//   PUT    { name, enabled } enable/disable
//   POST   { name, content } create
//
// Editing an existing skill's body is PUT on ./content.

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const res = await dashboard.skills()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ skills: res.data })
}

export async function PUT(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { name, enabled } = (await request.json()) as {
    name?: string
    enabled?: boolean
  }
  if (!name || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "name and enabled are required" }, { status: 400 })
  }

  const res = await dashboard.toggleSkill(name, enabled)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}

export async function POST(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { name, content, category } = (await request.json()) as {
    name?: string
    content?: string
    category?: string
  }
  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "name and content are required" }, { status: 400 })
  }

  const res = await dashboard.createSkill(name.trim(), content, category?.trim() || undefined)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
