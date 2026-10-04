import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

// ponytail: local disk volume, not S3/MinIO. Fine for a single-VM deployment;
// swap for an object-store client if this ever needs to scale horizontally.
const BLOB_DIR = process.env.BLOB_DIR ?? "/data/blobs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type BlobMeta = {
  storedName?: string
  name: string
  contentType: string
  size: number
}

// On-disk file name: uuid plus a sanitized extension, never the user's name, so
// it is safe to hand to the agent as "<BLOB_HOST_DIR>/<storedName>".
export function storedName(id: string, ext?: string): string {
  const safe = (ext ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)
  return `${id}.${safe || "bin"}`
}

export async function saveBlob(
  bytes: Buffer,
  meta: { name: string; contentType: string; ext?: string }
): Promise<string> {
  await mkdir(BLOB_DIR, { recursive: true })
  const id = randomUUID()
  const stored = storedName(id, meta.ext)
  const fullMeta: BlobMeta = {
    storedName: stored,
    name: meta.name,
    contentType: meta.contentType,
    size: bytes.length,
  }
  await writeFile(path.join(/*turbopackIgnore: true*/ BLOB_DIR, stored), bytes)
  await writeFile(
    path.join(/*turbopackIgnore: true*/ BLOB_DIR, `${id}.json`),
    JSON.stringify(fullMeta)
  )
  return id
}

export async function readBlob(
  id: string
): Promise<{
  bytes: Buffer
  name: string
  contentType: string
  storedName: string
} | null> {
  // Path-traversal boundary: id becomes a filename below, so it must be a
  // plain uuid before it ever touches the filesystem.
  if (!UUID_RE.test(id)) return null

  try {
    const meta = JSON.parse(
      await readFile(path.join(/*turbopackIgnore: true*/ BLOB_DIR, `${id}.json`), "utf8")
    ) as BlobMeta
    // Blobs written before extensions were kept live at <id>.bin.
    const stored = meta.storedName ?? `${id}.bin`
    // storedName comes from our own json, but keep it a plain file name anyway.
    if (stored !== path.basename(stored)) return null
    const bytes = await readFile(path.join(/*turbopackIgnore: true*/ BLOB_DIR, stored))
    return { bytes, name: meta.name, contentType: meta.contentType, storedName: stored }
  } catch {
    return null
  }
}
