import { and, eq, isNotNull } from "drizzle-orm"
import { db, schema } from "@/lib/db"

// Server-only: it imports lib/db directly. Kept out of app/api/chat/route.ts
// so that file stays a route, not a place to also read tables.
const MAX_APPENDED_CHARS = 60_000

// Everything a project's uploaded files contribute to a chat's system prompt.
// Only rows with extracted `text` count -- a PDF is stored (see
// app/api/projects/[projectId]/files/route.ts) but has nothing to read yet.
// Capped across ALL files combined, not per file, so five big uploads can't
// each burn the full budget; the file that crosses the cap is truncated with
// a marker instead of silently dropped.
export async function projectContext(projectId: string): Promise<string> {
  const files = await db
    .select({
      fileName: schema.projectFiles.fileName,
      text: schema.projectFiles.text,
    })
    .from(schema.projectFiles)
    .where(
      and(
        eq(schema.projectFiles.projectId, projectId),
        isNotNull(schema.projectFiles.text)
      )
    )

  if (files.length === 0) return ""

  let remaining = MAX_APPENDED_CHARS
  const blocks: string[] = []
  for (const file of files) {
    if (remaining <= 0) break
    const text = file.text ?? ""
    const take = Math.min(text.length, remaining)
    const chunk = take < text.length ? `${text.slice(0, take)}\n[truncated]` : text
    remaining -= take
    blocks.push(`### ${file.fileName}\n${chunk}`)
  }


  return `## Project files\n\n${blocks.join("\n\n")}`
}
