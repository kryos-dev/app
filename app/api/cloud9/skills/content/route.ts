import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

// The raw SKILL.md, read and written. This is the whole point of a Skills page
// that is not just a list: a skill IS its markdown, and reading it is how you
// find out what the agent will actually do.

export async function GET(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const name = new URL(request.url).searchParams.get("name")
  if (!name) return NextResponse.json({ error: "?name= is required" }, { status: 400 })

  const res = await dashboard.skillContent(name)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}

export async function PUT(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const { name, content } = (await request.json()) as {
    name?: string
    content?: string
  }
  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content are required" }, { status: 400 })
  }

  const res = await dashboard.updateSkill(name, content)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
