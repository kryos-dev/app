import type { UIMessage } from "ai"
import { fetchClient } from "../../fetch"
import { API_ROUTE_CHATS } from "../../routes"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

// v5 UIMessage has no room for our own per-message bookkeeping, so it rides
// along in `metadata`. `createdAt` is an ISO string (not a Date) since
// UIMessage/metadata must stay JSON-serialisable.
export type ZolaMessageMetadata = {
  createdAt?: string
  model?: string
}

export type ZolaUIMessage = UIMessage<ZolaMessageMetadata>

/** @deprecated kept as an alias during the v5 migration; use ZolaUIMessage. */
export type ExtendedMessageAISDK = ZolaUIMessage

type DbAttachment = { name?: string; contentType?: string; url: string }

type DbMessage = {
  id: number | string
  content: string | null
  role: string
  experimental_attachments?: DbAttachment[] | null
  created_at: string | null
  parts?: ZolaUIMessage["parts"] | null
  model?: string | null
}

// Rows Zola stored before chats moved to Hermes sessions have no `parts`
// column for user turns. Synthesize parts for whichever rows don't have them
// so every ZolaUIMessage is parts-only, per the v5 UIMessage shape.
type LegacyToolPart = {
  type: "tool-invocation"
  toolInvocation: {
    toolCallId: string
    toolName: string
    state: string
    args?: unknown
    result?: unknown
  }
}

// Rows written before the AI SDK 7 migration stored v4 `tool-invocation`
// parts (one "call" entry and one "result" entry per call). Fold them into
// the v5 `tool-<name>` shape, keeping the last entry per toolCallId.
function upgradeLegacyParts(parts: unknown[]): ZolaUIMessage["parts"] {
  const out: unknown[] = []
  const indexByCall = new Map<string, number>()
  for (const raw of parts) {
    const legacy = raw as Partial<LegacyToolPart>
    if (legacy?.type === "tool-invocation" && legacy.toolInvocation) {
      const t = legacy.toolInvocation
      const part = {
        type: `tool-${t.toolName}`,
        toolCallId: t.toolCallId,
        state: t.state === "result" ? "output-available" : "input-available",
        input: t.args ?? {},
        output: t.result,
      }
      const idx = indexByCall.get(t.toolCallId)
      if (idx === undefined) {
        indexByCall.set(t.toolCallId, out.length)
        out.push(part)
      } else {
        out[idx] = part
      }
    } else {
      out.push(raw)
    }
  }
  return out as ZolaUIMessage["parts"]
}

function partsFromDbMessage(message: DbMessage): ZolaUIMessage["parts"] {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return upgradeLegacyParts(message.parts as unknown[])
  }

  const parts: ZolaUIMessage["parts"] = []
  if (message.content) {
    parts.push({ type: "text", text: message.content })
  }
  for (const attachment of message.experimental_attachments ?? []) {
    if (!attachment.url) continue
    parts.push({
      type: "file",
      mediaType: attachment.contentType || "application/octet-stream",
      filename: attachment.name,
      url: attachment.url,
    })
  }
  return parts
}

function fromDbMessage(message: DbMessage): ZolaUIMessage {
  return {
    id: String(message.id),
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    parts: partsFromDbMessage(message),
    metadata: {
      createdAt: message.created_at ?? undefined,
      model: message.model ?? undefined,
    },
  }
}

// Loosely typed so it works across any useChat instance's UIMessage
// (different metadata/tool generics), not just ZolaUIMessage.
type PartsBearing = { parts: readonly { type: string; text?: string }[] }

/** Plain-text rendering of a UIMessage's text parts (for previews, edit boxes, copy). */
export function textFromMessage(message: PartsBearing): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function attachmentsFromMessage(
  message: PartsBearing
): { name: string; contentType: string; url: string }[] {
  return message.parts
    .filter(
      (p): p is { type: "file"; mediaType: string; filename?: string; url: string } =>
        p.type === "file"
    )
    .map((p) => ({
      name: p.filename || "attachment",
      contentType: p.mediaType,
      url: p.url,
    }))
}

export async function getMessagesFromDb(chatId: string): Promise<ZolaUIMessage[]> {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`)
  if (!res.ok) return []

  const data: { messages: DbMessage[] } = await res.json()
  return data.messages.map(fromDbMessage)
}

export type ChatHistory = {
  messages: ZolaUIMessage[]
  /** A turn is still running on the server; `messages` ends with its question. */
  pending: boolean
}

/** History for one chat; null when the chat does not exist, throws on any other failure. */
export async function fetchChatMessages(chatId: string): Promise<ChatHistory | null> {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to load messages")
  const data: { messages: DbMessage[]; pending: boolean } = await res.json()
  return { messages: data.messages.map(fromDbMessage), pending: data.pending }
}

async function deleteMessagesFromDb(chatId: string) {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "DELETE",
  })
  if (!res.ok) {
    console.error("Failed to clear messages from database")
  }
}

type ChatMessageEntry = {
  id: string
  messages: ZolaUIMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<ZolaUIMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) =>
      +new Date(a.metadata?.createdAt || 0) -
      +new Date(b.metadata?.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: ZolaUIMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
