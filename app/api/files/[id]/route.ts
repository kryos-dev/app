import { NextResponse } from "next/server"
import { readBlob } from "@/lib/blobs"

// Public on purpose: the id is a random uuid, and model providers fetch these
// urls directly with no way to send a cookie. Nothing sensitive goes here --
// it is chat attachments, addressed by an unguessable id.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const blob = await readBlob(id)
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new Response(new Uint8Array(blob.bytes), {
    headers: {
      "Content-Type": blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
