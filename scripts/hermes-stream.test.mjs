// Feeds hand-written Hermes session chat SSE samples through the mapper and
// asserts the UI message stream chunks and the reconstructed message. Run with:
//   npx tsx scripts/hermes-stream.test.mjs
import assert from "node:assert/strict"
import { hermesSessionStreamToUIMessageStream } from "../lib/hermes/stream.ts"

const encoder = new TextEncoder()
const frames = (evs) =>
  evs.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("")

async function run(sseText, { split = false } = {}) {
  const bytes = encoder.encode(sseText)
  const source = new ReadableStream({
    start(controller) {
      if (split) {
        const mid = Math.floor(bytes.length / 2)
        controller.enqueue(bytes.slice(0, mid))
        controller.enqueue(bytes.slice(mid))
      } else controller.enqueue(bytes)
      controller.close()
    },
  })
  let message
  const reader = hermesSessionStreamToUIMessageStream(source, {
    onFinish: ({ message: m }) => (message = m),
  }).getReader()
  const chunks = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return { chunks, message, types: chunks.map((c) => c.type) }
}

const textOf = (message) =>
  message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("")

// --- Reasoning, text, a tool that succeeds and one that fails, usage. ---
{
  const sse =
    ": keepalive\n\n" +
    frames([
      ["run.started", {}],
      ["message.started", {}],
      ["tool.progress", { tool_name: "_thinking", delta: "hmm" }],
      ["tool.started", { tool_name: "terminal", preview: "echo hi", args: { command: "echo hi" } }],
      ["tool.completed", { tool_name: "terminal", preview: JSON.stringify({ output: "hi" }) }],
      ["tool.started", { tool_name: "read_file", preview: "x", args: { path: "x" } }],
      ["tool.failed", { tool_name: "read_file", preview: "no such file" }],
      ["assistant.delta", { message_id: "m", delta: "Hel" }],
      ["assistant.delta", { message_id: "m", delta: "lo" }],
      ["assistant.completed", { content: "Hello" }],
      ["run.completed", { usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } }],
      ["done", {}],
    ])
  const { chunks, message, types } = await run(sse, { split: true })

  assert.equal(chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join(""), "Hello")
  assert.equal(
    chunks.filter((c) => c.type === "reasoning-delta").map((c) => c.delta).join(""),
    "hmm"
  )
  assert.equal(types.filter((t) => t === "finish").length, 1, "done must not finish twice")
  assert.equal(textOf(message), "Hello")

  const term = message.parts.find((p) => p.type === "tool-terminal")
  assert.equal(term.state, "output-available")
  assert.deepEqual(term.input, { command: "echo hi" })
  assert.deepEqual(term.output, { output: "hi" })
  const failed = message.parts.find((p) => p.type === "tool-read_file")
  assert.equal(failed.state, "output-error")
  assert.equal(failed.errorText, "no such file")

  const turn = message.parts.find((p) => p.type === "data-turn").data
  assert.equal(turn.usage.inputTokens, 10)
  assert.equal(typeof turn.tools?.[term.toolCallId], "number", "expected a per-tool duration")
}

// --- assistant.completed: appended when the streamed text is a prefix, a
// separate part when it differs, and the only text when nothing streamed. ---
{
  const done = [["run.completed", {}], ["done", {}]]
  const prefix = await run(
    frames([["assistant.delta", { delta: "See " }], ["assistant.completed", { content: "See ![i](data:image/png;base64,AA)" }], ...done])
  )
  assert.equal(textOf(prefix.message), "See ![i](data:image/png;base64,AA)")

  const none = await run(frames([["assistant.completed", { content: "Only" }], ...done]))
  assert.equal(textOf(none.message), "Only")

  const differs = await run(
    frames([["assistant.delta", { delta: "MEDIA:/a.png" }], ["assistant.completed", { content: "![i](data:image/png;base64,AA)" }], ...done])
  )
  assert.ok(textOf(differs.message).endsWith("![i](data:image/png;base64,AA)"))
}

// --- Commentary is text only when it was not already streamed. ---
{
  const { message } = await run(
    frames([
      ["assistant.commentary", { text: "skipped", already_streamed: true }],
      ["assistant.commentary", { text: "Working on it.", already_streamed: false }],
      ["run.completed", {}],
      ["done", {}],
    ])
  )
  assert.equal(textOf(message), "Working on it.")
}

// --- Failures surface as an error chunk and never as finish. ---
{
  for (const failure of [
    ["run.failed", { error: "boom" }],
    ["error", { message: "boom" }],
  ]) {
    const { chunks, types } = await run(frames([failure, ["done", {}]]))
    assert.equal(chunks.find((c) => c.type === "error").errorText, "boom")
    assert.ok(!types.includes("finish"))
  }
}

// --- Cancellation: the consumer drops after one chunk, yet onFinish must
// still receive the full text once the upstream drains. ---
{
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          frames([
            ["assistant.delta", { delta: "Hello" }],
            ["run.completed", {}],
            ["done", {}],
          ])
        )
      )
      controller.close()
    },
  })
  let resolveFinished
  const finished = new Promise((r) => (resolveFinished = r))
  let message
  const reader = hermesSessionStreamToUIMessageStream(source, {
    onFinish: ({ message: m }) => {
      message = m
      resolveFinished()
    },
  }).getReader()
  await reader.read()
  await reader.cancel()
  await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error("onFinish did not fire after cancel")), 2000)),
  ])
  assert.equal(textOf(message), "Hello")
}

console.log("hermes-stream.test.mjs: all assertions passed")

// --- Leading whitespace must not open a text part before real text arrives. ---
{
  const sse = frames([
    ["assistant.delta", { delta: "\n" }],
    ["assistant.delta", { delta: "Hello" }],
    ["assistant.completed", { content: "\nHello" }],
    ["run.completed", {}],
  ])
  const { chunks, message } = await run(sse)
  const firstText = chunks.findIndex((c) => c.type === "text-start")
  assert.ok(firstText >= 0)
  assert.equal(chunks[firstText + 1].delta, "Hello", "no whitespace-only text chunk before Hello")
  assert.equal(textOf(message), "Hello")
}
