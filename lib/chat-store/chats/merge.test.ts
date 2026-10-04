// node --import tsx lib/chat-store/chats/merge.test.ts
import assert from "node:assert/strict"
import test from "node:test"
import type { Chats } from "../types"
import { mergeChats } from "./merge"

function chat(id: string, runStatus?: Chats["run_status"]): Chats {
  return {
    id,
    user_id: "u",
    project_id: null,
    title: id,
    model: null,
    public: true,
    pinned: false,
    pinned_at: null,
    created_at: null,
    updated_at: null,
    ...(runStatus === undefined ? {} : { run_status: runStatus }),
  }
}

test("with nothing optimistic, the polled list replaces the local one", () => {
  const prev = [chat("a", "running"), chat("b")]
  const fresh = [chat("a", "complete"), chat("b", "failed")]
  assert.deepEqual(mergeChats(prev, fresh, new Set()), fresh)
})

test("an optimistic running chat survives a poll that has not registered the turn", () => {
  const merged = mergeChats([chat("a", "running")], [chat("a", null)], new Set(["a"]))
  assert.equal(merged[0].run_status, "running")
})

test("an optimistic terminal chat survives a poll that has not settled the turn", () => {
  const merged = mergeChats([chat("a", "complete")], [chat("a", null)], new Set(["a"]))
  assert.equal(merged[0].run_status, "complete")
})

test("a server-reported status wins over the optimistic one", () => {
  const merged = mergeChats([chat("a", "running")], [chat("a", "failed")], new Set(["a"]))
  assert.equal(merged[0].run_status, "failed")
})

test("a chat that is not optimistically guarded is not preserved", () => {
  const merged = mergeChats([chat("a", "running")], [chat("a", null)], new Set(["b"]))
  assert.equal(merged[0].run_status, null)
})

test("other chats are left exactly as the poll reported them", () => {
  const merged = mergeChats(
    [chat("a", "running"), chat("b", "complete")],
    [chat("a", null), chat("b", "failed")],
    new Set(["a"])
  )
  assert.equal(merged[0].run_status, "running")
  assert.equal(merged[1].run_status, "failed")
})
