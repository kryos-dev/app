// node --import tsx lib/runs.test.ts
// DATABASE_URL is not needed: lib/runs.ts touches no database.
import assert from "node:assert/strict"
import test from "node:test"
import type { UIMessageChunk } from "ai"
import { abortRun, beginRun, endRun, hasRun } from "./runs"

async function drain(stream: ReadableStream<UIMessageChunk>) {
  const out: UIMessageChunk[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return out
    out.push(value)
  }
}

test("a subscriber gets the buffer, then live chunks, then close", async () => {
  const run = await beginRun("chat-a")
  run.publish({ type: "start", messageId: "7" })
  const sub = drain(run.subscribe())
  run.publish({ type: "text-start", id: "t" })
  endRun("chat-a", run)
  const got = await sub
  assert.deepEqual(got.map((c) => c.type), ["start", "text-start"])
  assert.equal(hasRun("chat-a"), false)
})

test("a subscriber that arrives after the end still gets the replay", async () => {
  const run = await beginRun("chat-b")
  run.publish({ type: "start" })
  endRun("chat-b", run)
  assert.equal((await drain(run.subscribe())).length, 1)
})

test("abort signals the turn but keeps the run until it ends", async () => {
  const run = await beginRun("chat-c")
  assert.equal(abortRun("chat-c"), true)
  assert.equal(run.controller.signal.aborted, true)
  assert.equal(hasRun("chat-c"), true)
  endRun("chat-c", run)
  await run.done
  assert.equal(hasRun("chat-c"), false)
  assert.equal(abortRun("chat-c"), false)
})
