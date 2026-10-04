import { getCurrentUser } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * The AI SDK probes this endpoint when `useChat` has resume enabled:
 * GET /api/chat/{chatId}/stream. This runtime does not keep resumable SSE
 * streams, so there is nothing to reattach to. Return the SDK's expected
 * "no active stream" response rather than letting Next serve an HTML 404 (or
 * validating the ID against the UUID column and returning a 500 for a client
 * generated ID).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  })
}
