import { createUIMessageStream, type UIMessage, type UIMessageStreamWriter } from "ai"
import { toolTimer, turnData } from "@/lib/turn"

// Maps Hermes Agent's `/v1/responses` SSE (OpenAI Responses API shape) to the
// AI SDK v5+ UI message stream protocol. Emits writer.write() chunks;
// createUIMessageStream reconstructs the final assistant UIMessage (with
// `.parts`) for onFinish persistence.
//
// Event names below are taken verbatim from Hermes 0.21.2
// gateway/platforms/api_server_openai_routes.py (commit 939e45c):
//   response.created                 (line 201) - ignored, no stream equivalent
//   response.output_item.added       (lines 211, 240) -> tool-input-start (+ tool-input-delta)
//   response.output_text.delta       (line 219) -> text-delta
//   response.output_item.done        (lines 253, 266, 332) -> tool-input-available / tool-output-available
//   response.output_text.done        (line 328) - ignored, redundant with deltas
//   response.completed               (line 369) -> finish
//   response.failed                  (lines 355, 374) -> error
//
// `response.output_item.added` with item.type === "function_call" is sent when
// the tool STARTS (emit_tool_started, line 224), before it runs; it carries
// name, call_id and the arguments as a JSON string. Mapped to tool-input-start
// so the running step shows at once, plus one tool-input-delta with the
// arguments so its summary (command, path) shows too. The later `done` has the
// same call_id, so tool-input-available updates that part rather than adding one.
// Added items of type "message" / "function_call_output" are ignored.
//
// `response.output_item.done` carries one `item`:
//   item.type === "function_call" && item.status === "completed"      -> tool-input-available
//   item.type === "function_call_output"                              -> tool-output-available
//   item.type === "message"                                           -> ignored (text already streamed)
//
// Reasoning arrives as the standard reasoning_text / reasoning_summary_text
// deltas and is mapped by writeReasoningDelta below.

type HermesStreamOpts = {
  onFinish?: (payload: { message: UIMessage }) => void | Promise<void>
}

function parseJsonOr<T>(text: string, fallback: (raw: string) => T): T {
  try {
    return JSON.parse(text)
  } catch {
    return fallback(text)
  }
}

const TEXT_ID = "hermes-text"

async function writeHermesResponses(
  sse: ReadableStream<Uint8Array>,
  writer: UIMessageStreamWriter
): Promise<void> {
  const decoder = new TextDecoder()
  let textOpen = false
  const startedAt = Date.now()
  // Per-tool wall clock: from output_item.added (tool started) to its
  // function_call_output (tool finished).
  const timer = toolTimer()

  writer.write({ type: "start" })

  // Live reasoning from the standard Responses events goes through
  // writeReasoningDelta, which gives each thinking block its own part and
  // closes it as soon as text or a tool call follows.
  let reasoningId: string | null = null
  let reasoningCount = 0
  const closeReasoningIfOpen = () => {
    if (reasoningId) {
      writer.write({ type: "reasoning-end", id: reasoningId })
      reasoningId = null
    }
  }
  const writeReasoningDelta = (delta: string) => {
    if (!delta) return
    if (textOpen) {
      writer.write({ type: "text-end", id: TEXT_ID })
      textOpen = false
    }
    if (!reasoningId) {
      reasoningId = `hermes-reasoning-${reasoningCount++}`
      writer.write({ type: "reasoning-start", id: reasoningId })
    }
    writer.write({ type: "reasoning-delta", id: reasoningId, delta })
  }

  const closeTextIfOpen = () => {
    closeReasoningIfOpen()
    if (textOpen) {
      writer.write({ type: "text-end", id: TEXT_ID })
      textOpen = false
    }
  }

  const handleFrame = (frame: string) => {
    const dataLine = frame.split("\n").find((line) => line.startsWith("data:"))
    if (!dataLine) return
    const raw = dataLine.slice(5).trim()
    if (!raw || raw === "[DONE]") return

    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    switch (data.type as string) {
      case "response.output_text.delta": {
        if (typeof data.delta === "string") {
          closeReasoningIfOpen()
          if (!textOpen) {
            writer.write({ type: "text-start", id: TEXT_ID })
            textOpen = true
          }
          writer.write({ type: "text-delta", id: TEXT_ID, delta: data.delta })
        }
        break
      }
      // Native reasoning: the gateway streams summary deltas on this SSE.
      case "response.reasoning_text.delta":
      case "response.reasoning_summary_text.delta": {
        if (typeof data.delta === "string") writeReasoningDelta(data.delta)
        break
      }
      case "response.output_item.added": {
        const item = data.item as Record<string, unknown> | undefined
        if (item?.type !== "function_call" || !item.call_id) break
        closeTextIfOpen()
        const toolCallId = String(item.call_id)
        timer.start(toolCallId)
        writer.write({ type: "tool-input-start", toolCallId, toolName: String(item.name) })
        if (typeof item.arguments === "string" && item.arguments) {
          writer.write({ type: "tool-input-delta", toolCallId, inputTextDelta: item.arguments })
        }
        break
      }
      case "response.output_item.done": {
        const item = data.item as Record<string, unknown> | undefined
        if (!item) break
        if (item.type === "function_call" && item.status === "completed") {
          closeTextIfOpen()
          const input = parseJsonOr(String(item.arguments ?? "{}"), (r) => ({
            raw: r,
          }))
          writer.write({
            type: "tool-input-available",
            toolCallId: String(item.call_id),
            toolName: String(item.name),
            input,
          })
        } else if (item.type === "function_call_output") {
          closeTextIfOpen()
          const output = item.output as Array<{ text?: string }> | undefined
          const text = output?.[0]?.text ?? ""
          const result = parseJsonOr<unknown>(text, (r) => r)
          timer.end(String(item.call_id))
          writer.write({
            type: "tool-output-available",
            toolCallId: String(item.call_id),
            output: result,
          })
        }
        break
      }
      case "response.completed": {
        closeTextIfOpen()
        const usage = (data.response as { usage?: Record<string, number> } | undefined)
          ?.usage
        writer.write({
          type: "data-turn",
          id: "turn",
          data: turnData(startedAt, {
            inputTokens: usage?.input_tokens,
            outputTokens: usage?.output_tokens,
            totalTokens: usage?.total_tokens,
          }, timer.tools),
        })
        writer.write({ type: "finish" })
        break
      }
      case "response.failed": {
        closeTextIfOpen()
        const response = data.response as Record<string, unknown> | undefined
        const error = response?.error
        const message =
          typeof error === "string"
            ? error
            : (error as { message?: string })?.message ||
              "Hermes agent request failed"
        writer.write({ type: "error", errorText: message })
        break
      }
      default:
        break
    }
  }

  const reader = sse.getReader()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        handleFrame(buf.slice(0, idx))
        buf = buf.slice(idx + 2)
      }
    }
    if (buf.trim()) handleFrame(buf)
    closeTextIfOpen()
  } catch (err) {
    closeTextIfOpen()
    writer.write({
      type: "error",
      errorText: err instanceof Error ? err.message : String(err),
    })
  } finally {
  }
}

export function hermesResponsesToUIMessageStream(
  sse: ReadableStream<Uint8Array>,
  opts: HermesStreamOpts = {}
) {
  // Two nested UI message streams, not one: the inner one is read to
  // completion right here (never by the HTTP response consumer), so its
  // onFinish always fires from a normal `flush` once the SSE fully drains -
  // never from `cancel`, whose accumulated text would be truncated at
  // whatever point the browser disconnected. The outer stream just relays
  // chunks to the real client and keeps forwarding (into a writer that
  // silently no-ops once cancelled) even after that client goes away, so
  // the inner read loop is never starved.
  const inner = createUIMessageStream({
    execute: async ({ writer }) => {
      await writeHermesResponses(sse, writer)
    },
    onFinish: async ({ responseMessage }) => {
      try {
        await opts.onFinish?.({ message: responseMessage })
      } catch (err) {
        console.error("hermes onFinish persistence failed:", err)
      }
    },
  })

  return createUIMessageStream({
    execute: async ({ writer }) => {
      const reader = inner.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          writer.write(value)
        }
      } catch (err) {
        writer.write({
          type: "error",
          errorText: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })
}
