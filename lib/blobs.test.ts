import assert from "node:assert"
import { randomUUID } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

async function main() {
  process.env.BLOB_DIR = await mkdtemp(path.join(os.tmpdir(), "blobs-test-"))

  const { saveBlob, readBlob } = await import("./blobs")

  // save/read roundtrip preserves bytes + name + contentType
  const bytes = Buffer.from("hello world")
  const id = await saveBlob(bytes, { name: "hello.txt", contentType: "text/plain" })
  const read = await readBlob(id)
  assert(read, "expected blob to be found")
  assert(read.bytes.equals(bytes))
  assert.equal(read.name, "hello.txt")
  assert.equal(read.contentType, "text/plain")

  // path traversal is rejected before touching the filesystem
  assert.equal(await readBlob("../../etc/passwd"), null)

  // well-formed but unknown id returns null
  assert.equal(await readBlob(randomUUID()), null)

  console.log("blob tests ok")
}

main()
