import * as fileType from "file-type"
import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { saveBlob } from "@/lib/blobs"
import { db, schema } from "@/lib/db"
import { ALLOWED_FILE_TYPES } from "@/lib/file-handling"

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024 // 20MB, same limit as app/api/files/route.ts
const MAX_EXTRACTED_CHARS = 200_000

// file-type sniffs magic bytes, which plain text has none of -- it returns
// undefined for a .txt/.md/.json/.csv file even though ALLOWED_FILE_TYPES
// already lists their mime types. Extension is the only signal left for
// those, so it's used here, in this route only, purely to fill in what
// sniffing couldn't.
const EXTENSION_MIME: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  csv: "text/csv",
}

function mimeFromExtension(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase()
  return (ext && EXTENSION_MIME[ext]) || null
}

async function requireOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
  return project ?? null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const project = await requireOwnedProject(projectId, user.id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const files = await db
    .select()
    .from(schema.projectFiles)
    .where(eq(schema.projectFiles.projectId, projectId))

  return NextResponse.json(files)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const project = await requireOwnedProject(projectId, user.id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB limit` },
      { status: 413 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffed = await fileType.fileTypeFromBuffer(buffer.subarray(0, 4100))
  const mime = sniffed?.mime ?? mimeFromExtension(file.name)
  if (!mime || !ALLOWED_FILE_TYPES.includes(mime)) {
    return NextResponse.json(
      { error: "File type not supported or doesn't match its extension" },
      { status: 415 }
    )
  }

  const id = await saveBlob(buffer, { name: file.name, contentType: mime })

  // Only text we can decode straight away gets read into the prompt (see
  // lib/projects/context.ts). Everything else -- a PDF today -- is stored so
  // it shows up in the list, with `text` null meaning "not read yet", not
  // "failed".
  const text =
    mime.startsWith("text/") || mime === "application/json"
      ? buffer.toString("utf8").slice(0, MAX_EXTRACTED_CHARS)
      : null

  const [row] = await db
    .insert(schema.projectFiles)
    .values({
      projectId,
      userId: user.id,
      fileUrl: `/api/files/${id}`,
      fileName: file.name,
      fileType: mime,
      fileSize: file.size,
      text,
    })
    .returning()

  return NextResponse.json(row)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const project = await requireOwnedProject(projectId, user.id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const fileId = request.nextUrl.searchParams.get("fileId")
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 })

  // Row deletion only -- the blob on disk is left behind, same as every other
  // attachment table in this app (chatAttachments does the same).
  const [deleted] = await db
    .delete(schema.projectFiles)
    .where(
      and(
        eq(schema.projectFiles.id, fileId),
        eq(schema.projectFiles.projectId, projectId),
        eq(schema.projectFiles.userId, user.id)
      )
    )
    .returning()

  if (!deleted) return NextResponse.json({ error: "File not found" }, { status: 404 })
  return NextResponse.json(deleted)
}
