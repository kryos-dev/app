// Feeds a hand-written Hermes /v1/responses SSE sample through the mapper
// and asserts the UI message stream chunks it produces. Run with:
//   npx tsx scripts/hermes-stream.test.mjs
import assert from "node:assert/strict"
import { hermesResponsesToUIMessageStream } from "../lib/hermes/stream.ts"

const events = [
  { type: "response.created" },
  { type: "response.output_text.delta", delta: "Hel" },
  { type: "response.output_text.delta", delta: "lo" },
  {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      status: "completed",
      call_id: "call_1",
      name: "terminal",
      arguments: JSON.stringify({ command: "echo hi" }),
    },
  },
  {
    type: "response.output_item.done",
    item: {
      type: "function_call_output",
      call_id: "call_1",
      output: [{ text: JSON.stringify({ output: "hi" }) }],
    },
  },
  {
    type: "response.completed",
    response: { usage: { input_tokens: 10, output_tokens: 2 } },
  },
]

const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n"

const encoder = new TextEncoder()
const sourceStream = new ReadableStream({
  start(controller) {
    const bytes = encoder.encode(sseText)
    const mid = Math.floor(bytes.length / 2)
    controller.enqueue(bytes.slice(0, mid))
    controller.enqueue(bytes.slice(mid))
    controller.close()
  },
})

let finishedMessage
const uiStream = hermesResponsesToUIMessageStream(sourceStream, {
  onFinish: ({ message }) => {
    finishedMessage = message
  },
})

const reader = uiStream.getReader()
const chunks = []
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  chunks.push(value)
}

console.log(JSON.stringify(chunks, null, 2))

const types = chunks.map((c) => c.type)
assert.ok(types.includes("start"), "expected a start chunk")

const textDeltas = chunks.filter((c) => c.type === "text-delta")
assert.equal(
  textDeltas.map((c) => c.delta).join(""),
  "Hello",
  "expected text deltas to reassemble to 'Hello'"
)

const toolInputChunk = chunks.find((c) => c.type === "tool-input-available")
assert.ok(toolInputChunk, "expected a tool-input-available chunk")
assert.equal(toolInputChunk.toolCallId, "call_1")
assert.equal(toolInputChunk.toolName, "terminal")
assert.deepEqual(toolInputChunk.input, { command: "echo hi" })

const toolOutputChunk = chunks.find((c) => c.type === "tool-output-available")
assert.ok(toolOutputChunk, "expected a tool-output-available chunk")
assert.equal(toolOutputChunk.toolCallId, "call_1")
assert.deepEqual(toolOutputChunk.output, { output: "hi" })

assert.ok(types.includes("finish"), "expected a finish chunk")

assert.ok(finishedMessage, "expected onFinish to receive the reconstructed message")
const finishedText = finishedMessage.parts
  .filter((p) => p.type === "text")
  .map((p) => p.text)
  .join("")
assert.equal(finishedText, "Hello")
const finishedToolPart = finishedMessage.parts.find(
  (p) => p.type === "tool-terminal"
)
assert.ok(finishedToolPart, "expected a tool-terminal part on the reconstructed message")
assert.equal(finishedToolPart.state, "output-available")

// --- Cancellation: simulates a browser refresh mid-stream. The HTTP
// consumer cancels the output reader after only the first chunk, but
// onFinish must still receive the full accumulated text once the upstream
// SSE finishes draining in the background. ---
{
  const sourceStream2 = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText))
      controller.close()
    },
  })

  let finishedMessage2
  let resolveFinished
  const finished2 = new Promise((resolve) => {
    resolveFinished = resolve
  })
  const uiStream2 = hermesResponsesToUIMessageStream(sourceStream2, {
    onFinish: ({ message }) => {
      finishedMessage2 = message
      resolveFinished()
    },
  })

  const reader2 = uiStream2.getReader()
  await reader2.read() // consume only the first chunk
  await reader2.cancel() // simulate the client disconnecting

  await Promise.race([
    finished2,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("onFinish did not fire after cancel")),
        2000
      )
    ),
  ])

  const finishedText2 = finishedMessage2.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("")
  assert.equal(
    finishedText2,
    "Hello",
    "expected onFinish to receive full text even after the reader was cancelled early"
  )
}

// --- Tool start (response.output_item.added, sent before the tool runs):
// becomes tool-input-start right away, and the later output_item.done with the
// same call_id updates that part instead of adding a second one. ---
{
  const call = { type: "function_call", call_id: "call_9", name: "terminal", arguments: JSON.stringify({ command: "ls" }) }
  const started = [
    { type: "response.output_text.delta", delta: "Looking." },
    { type: "response.output_item.added", item: { type: "message", status: "in_progress", content: [] } },
    { type: "response.output_item.added", item: { ...call, status: "in_progress" } },
  ]
  const finished = [
    { type: "response.output_item.done", item: { ...call, status: "completed" } },
    { type: "response.output_item.added", item: { type: "function_call_output", call_id: "call_9", output: [{ text: "a b" }] } },
    { type: "response.output_item.done", item: { type: "function_call_output", call_id: "call_9", output: [{ text: "a b" }] } },
    { type: "response.completed", response: {} },
  ]
  const frames = (evs) => encoder.encode(evs.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""))
  let release
  const toolRan = new Promise((r) => (release = r))
  let message4
  const uiStream4 = hermesResponsesToUIMessageStream(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(frames(started))
        await toolRan // the tool is "running" until the test has seen its start
        controller.enqueue(frames(finished))
        controller.close()
      },
    }),
    { onFinish: ({ message }) => (message4 = message) }
  )
  const reader4 = uiStream4.getReader()
  const seen = []
  for (;;) {
    const { done, value } = await reader4.read()
    if (done) break
    seen.push(value)
    if (value.type === "tool-input-delta") release()
  }
  const types4 = seen.map((c) => c.type)
  const startIdx = types4.indexOf("tool-input-start")
  assert.ok(startIdx !== -1, "expected output_item.added to map to tool-input-start")
  assert.ok(types4.indexOf("text-end") < startIdx, "expected the text to be closed before the tool starts")
  assert.deepEqual(
    seen.slice(startIdx, startIdx + 2),
    [
      { type: "tool-input-start", toolCallId: "call_9", toolName: "terminal" },
      { type: "tool-input-delta", toolCallId: "call_9", inputTextDelta: call.arguments },
    ],
    "expected tool-input-start then the arguments as one delta"
  )
  assert.equal(types4.filter((t) => t === "tool-input-start").length, 1, "message/output added items are ignored")
  assert.ok(startIdx < types4.indexOf("tool-input-available"), "expected start before input-available")
  assert.equal(seen.find((c) => c.type === "tool-input-available").toolCallId, "call_9")
  const toolParts = message4.parts.filter((p) => p.type === "tool-terminal")
  assert.equal(toolParts.length, 1, "expected one tool part, not a duplicate")
  assert.equal(toolParts[0].state, "output-available")
  assert.deepEqual(toolParts[0].input, { command: "ls" })
  const turn = message4.parts.find((p) => p.type === "data-turn").data
  assert.equal(typeof turn.tools?.call_9, "number", "expected a per-tool duration")
}

console.log("hermes-stream.test.mjs: all assertions passed")
