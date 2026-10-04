import { chatOwnerId } from "@/lib/auth/guards"
import { getCurrentUser } from "@/lib/auth"
import { abortRun } from "@/lib/runs"
import { NextResponse } from "next/server"

/**
 * POST /api/chat/abort — stop the turn running for a chat.
 *
 * The Stop button aborts the browser's fetch, which this server ignores on
 * purpose so a reply survives the tab closing. This is how the client says
 * "no, actually stop" and gets the upstream model request cancelled.
 *
 * Always 200 with `{ aborted }`: nothing in flight is a normal answer (the
 * turn may have finished between the click and this request), and a failure
 * here must never surface as an error in a chat the user just stopped.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { chatId } = (await req.json().catch(() => ({}))) as { chatId?: string }
  if (!chatId) return NextResponse.json({ aborted: false })

  const owner = await chatOwnerId(chatId)
  if (owner && owner !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  return NextResponse.json({ aborted: abortRun(chatId) })
}
