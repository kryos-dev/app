import { getCurrentUser } from "@/lib/auth"
import { chatOwnerId } from "@/lib/auth/guards"
import { getRun } from "@/lib/runs"
import { createUIMessageStreamResponse } from "ai"
import { NextResponse } from "next/server"

/**
 * Where `useChat` reattaches (GET /api/chat/{chatId}/stream) after a dropped
 * connection or a reload mid-reply. While a turn is running for the chat, the
 * response replays its recorded chunks and then follows it live. With no turn
 * running there is nothing to attach to and the answer is the SDK's "no active
 * stream" 204; the client then reads the stored reply instead.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { chatId } = await params
  const owner = await chatOwnerId(chatId)
  if (owner && owner !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  const run = getRun(chatId)
  if (!run) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    })
  }
  return createUIMessageStreamResponse({ stream: run.subscribe() })
}
