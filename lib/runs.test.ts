// node --import tsx lib/runs.test.ts
// DATABASE_URL is not needed: lib/runs.ts touches no database.
import assert from "node:assert/strict"
import test from "node:test"
import type { UIMessageChunk } from "ai"
import { abortRun, beginRun, discardRun, endRun, getRunStatus, hasRun } from "./runs"

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
  endRun("chat-a", run, "complete")
  const got = await sub
  assert.deepEqual(got.map((c) => c.type), ["start", "text-start"])
  assert.equal(hasRun("chat-a"), false)
})

test("a subscriber that arrives after the end still gets the replay", async () => {
  const run = await beginRun("chat-b")
  run.publish({ type: "start" })
  endRun("chat-b", run, "complete")
  assert.equal((await drain(run.subscribe())).length, 1)
})

test("abort signals the turn but keeps the run until it ends", async () => {
  const run = await beginRun("chat-c")
  assert.equal(abortRun("chat-c"), true)
  assert.equal(run.controller.signal.aborted, true)
  assert.equal(hasRun("chat-c"), true)
  endRun("chat-c", run, "complete")
  await run.done
  assert.equal(hasRun("chat-c"), false)
  assert.equal(abortRun("chat-c"), false)
})

// --- Status transitions ---------------------------------------------------

test("a turn is running once begun, and endRun records its terminal status", async () => {
  const run = await beginRun("chat-status-a")
  assert.equal(getRunStatus("chat-status-a"), "running")
  endRun("chat-status-a", run, "complete")
  assert.equal(getRunStatus("chat-status-a"), "complete")
  assert.equal(hasRun("chat-status-a"), false)
})

test("a failed turn keeps its failed status until the next run starts", async () => {
  const run = await beginRun("chat-status-b")
  endRun("chat-status-b", run, "failed")
  assert.equal(getRunStatus("chat-status-b"), "failed")

  const next = await beginRun("chat-status-b")
  assert.equal(getRunStatus("chat-status-b"), "running")
  endRun("chat-status-b", next, "complete")
  assert.equal(getRunStatus("chat-status-b"), "complete")
})

test("a chat that never ran has no status", () => {
  assert.equal(getRunStatus("chat-status-none"), undefined)
})

test("discarding a run clears its status without recording a terminal one", async () => {
  const run = await beginRun("chat-status-discard")
  assert.equal(getRunStatus("chat-status-discard"), "running")
  discardRun("chat-status-discard", run)
  assert.equal(getRunStatus("chat-status-discard"), undefined)
  assert.equal(hasRun("chat-status-discard"), false)
})

test("endRun for a run that is no longer current leaves the recorded status alone", async () => {
  const run = await beginRun("chat-status-stale")
  endRun("chat-status-stale", run, "failed")
  endRun("chat-status-stale", run, "complete")
  assert.equal(getRunStatus("chat-status-stale"), "failed")
})
