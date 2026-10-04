import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"

// Reads a chat's transcript from the Hermes Sessions API and maps it to the
// UIMessage shape the chat UI renders. Hermes is the only store for turns that
// ran through a session.

/** One row of `GET /api/sessions/{id}/messages`. */
export type HermesRow = {
  id: number | string
  role: string
  /** A string, or OpenAI-style parts (`text`, `image_url`) for multimodal turns. */
  content?: string | HermesContentPart[] | null
  tool_call_id?: string | null
  tool_calls?: HermesToolCall[] | null
  tool_name?: string | null
  /** Epoch seconds. */
  timestamp?: number | null
  reasoning?: string | null
  reasoning_content?: string | null
  display_kind?: string | null
}

type HermesContentPart = {
  type?: string
  text?: string
  image_url?: { url?: string } | string
}

type HermesToolCall = {
  id?: string
  function?: { name?: string; arguments?: string }
}

type Part = ZolaUIMessage["parts"][number]

function textOf(content: HermesRow["content"]): string {
  if (typeof content === "string") return content
  return (content ?? [])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("\n")
}

function imageParts(content: HermesRow["content"]): Part[] {
  if (!Array.isArray(content)) return []
  const parts: Part[] = []
  for (const p of content) {
    if (p.type !== "image_url") continue
    const url = typeof p.image_url === "string" ? p.image_url : p.image_url?.url
    if (!url) continue
    parts.push({
      type: "file",
      mediaType: /^data:([^;,]+)/.exec(url)?.[1] ?? "image/*",
      url,
    })
  }
  return parts
}

function parseJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "")
  } catch {
    return undefined
  }
}

// Tool results are stored as plain strings; the tools report failure as a JSON
// object with an `error` field.
function toolError(content: string): string | null {
  const parsed = parseJson(content) as { error?: unknown } | undefined
  if (!parsed || typeof parsed !== "object" || !parsed.error) return null
  return typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error)
}

function createdAt(row: HermesRow): string | undefined {
  return typeof row.timestamp === "number"
    ? new Date(row.timestamp * 1000).toISOString()
    : undefined
}

/**
 * Maps transcript rows to UI messages. System rows and rows marked
 * `display_kind: "hidden"` are dropped: Hermes blanks compaction handoffs and
 * diagnostic notices to that marker before they reach the API. Consecutive assistant and tool rows form one assistant turn: tool
 * rows are joined to the assistant `tool_calls` by `tool_call_id` and folded
 * into that call's part, so a turn renders as it did while streaming.
 */
export function mapHermesMessages(rows: HermesRow[]): ZolaUIMessage[] {
  const results = new Map<string, string>()
  for (const row of rows) {
    if (row.role === "tool" && row.tool_call_id) {
      results.set(row.tool_call_id, textOf(row.content))
    }
  }

  const out: ZolaUIMessage[] = []
  let turn: ZolaUIMessage | null = null

  for (const row of rows) {
    if (row.display_kind === "hidden") continue

    if (row.role === "user") {
      turn = null
      const text = textOf(row.content)
      out.push({
        id: `h${row.id}`,
        role: "user",
        parts: [...(text ? [{ type: "text" as const, text }] : []), ...imageParts(row.content)],
        metadata: { createdAt: createdAt(row) },
      })
    } else if (row.role === "assistant") {
      if (!turn) {
        turn = {
          id: `h${row.id}`,
          role: "assistant",
          parts: [],
          metadata: { createdAt: createdAt(row) },
        }
        out.push(turn)
      }
      const reasoning = row.reasoning_content || row.reasoning
      if (reasoning) turn.parts.push({ type: "reasoning", text: reasoning, state: "done" })
      const text = textOf(row.content)
      if (text) turn.parts.push({ type: "text", text })

      for (const call of row.tool_calls ?? []) {
        const toolCallId = call.id ?? `${row.id}-${turn.parts.length}`
        const base = {
          type: `tool-${call.function?.name ?? "tool"}`,
          toolCallId,
          input: parseJson(call.function?.arguments) ?? {},
        }
        const result = results.get(toolCallId)
        const error = result === undefined ? null : toolError(result)
        turn.parts.push(
          (result === undefined
            ? { ...base, state: "input-available" }
            : error
              ? { ...base, state: "output-error", errorText: error }
              : { ...base, state: "output-available", output: result }) as Part
        )
      }
    }
  }

  return out
}

const PAGE = 500

/**
 * The session's whole transcript as UI messages, compacted history included
 * (Hermes archives older turns of a long session and omits them unless asked).
 * A session Hermes no longer has is empty.
 */
export async function hermesMessages(sessionId: string): Promise<ZolaUIMessage[]> {
  const rows: HermesRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(
      `${process.env.HERMES_API_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages?order=oldest&limit=${PAGE}&offset=${offset}&include_compacted=true`,
      { headers: { Authorization: `Bearer ${process.env.HERMES_API_KEY}` } }
    )
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`Hermes messages failed (${res.status})`)
    const body = (await res.json()) as {
      data?: HermesRow[]
      pagination?: { returned?: number }
    }
    const page = body.data ?? []
    rows.push(...page)
    if ((body.pagination?.returned ?? page.length) < PAGE) break
  }
  return mapHermesMessages(rows)
}
