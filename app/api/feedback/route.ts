import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message } = await request.json()
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  await db.insert(schema.feedback).values({ userId: user.id, message })
  return NextResponse.json({ success: true })
}
