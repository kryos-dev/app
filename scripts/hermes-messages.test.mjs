// Feeds hand-written Hermes transcript rows through the mapper and asserts the
// UI messages. Run with:
//   npx tsx scripts/hermes-messages.test.mjs
import assert from "node:assert/strict"
import { mapHermesMessages } from "../lib/hermes/messages.ts"

const call = (id, name, args) => ({ id, function: { name, arguments: JSON.stringify(args) } })

// user text; system and hidden rows are dropped
{
  const out = mapHermesMessages([
    { id: 1, role: "system", content: "be nice" },
    { id: 2, role: "user", content: "hello", timestamp: 1700000000 },
    { id: 3, role: "user", content: "", display_kind: "hidden" },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, "h2")
  assert.equal(out[0].role, "user")
  assert.deepEqual(out[0].parts, [{ type: "text", text: "hello" }])
  assert.equal(out[0].metadata.createdAt, "2023-11-14T22:13:20.000Z")
}

// user with an image data URL
{
  const url = "data:image/png;base64,AAAA"
  const [msg] = mapHermesMessages([
    {
      id: 4,
      role: "user",
      content: [
        { type: "text", text: "what is this" },
        { type: "image_url", image_url: { url } },
      ],
    },
  ])
  assert.deepEqual(msg.parts, [
    { type: "text", text: "what is this" },
    { type: "file", mediaType: "image/png", url },
  ])
}

// assistant turn: reasoning + tool call + tool result + final text, one message
{
  const out = mapHermesMessages([
    { id: 5, role: "user", content: "weather?" },
    {
      id: 6,
      role: "assistant",
      content: "Checking.",
      reasoning_content: "need the weather tool",
      tool_calls: [call("c1", "weather", { city: "Oslo" })],
    },
    { id: 7, role: "tool", tool_call_id: "c1", tool_name: "weather", content: '{"temp":3}' },
    { id: 8, role: "assistant", content: "It is 3 degrees." },
  ])
  assert.equal(out.length, 2)
  const turn = out[1]
  assert.equal(turn.id, "h6")
  assert.deepEqual(turn.parts, [
    { type: "reasoning", text: "need the weather tool", state: "done" },
    { type: "text", text: "Checking." },
    {
      type: "tool-weather",
      toolCallId: "c1",
      input: { city: "Oslo" },
      state: "output-available",
      output: '{"temp":3}',
    },
    { type: "text", text: "It is 3 degrees." },
  ])
}

// error tool result, and a call with no result yet
{
  const [msg] = mapHermesMessages([
    {
      id: 9,
      role: "assistant",
      tool_calls: [call("c2", "shell", { cmd: "ls" }), call("c3", "shell", { cmd: "pwd" })],
    },
    { id: 10, role: "tool", tool_call_id: "c2", content: '{"error":"permission denied"}' },
  ])
  assert.deepEqual(msg.parts, [
    {
      type: "tool-shell",
      toolCallId: "c2",
      input: { cmd: "ls" },
      state: "output-error",
      errorText: "permission denied",
    },
    { type: "tool-shell", toolCallId: "c3", input: { cmd: "pwd" }, state: "input-available" },
  ])
}

console.log("hermes-messages: ok")
