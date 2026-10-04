import type { UIMessage } from "ai"
import { fetchClient } from "../../fetch"
import { API_ROUTE_CHATS } from "../../routes"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

// v5 UIMessage has no room for our own per-message bookkeeping, so it rides
// along in `metadata`. `createdAt` is an ISO string (not a Date) since
// UIMessage/metadata must stay JSON-serialisable.
export type ZolaMessageMetadata = {
  createdAt?: string
  message_group_id?: string
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
  message_group_id?: string | null
  model?: string | null
}

// User rows never get a `parts` column written (see app/api/chat/api.ts
// logUserMessage); assistant rows always do (app/api/chat/db.ts). Synthesize
// parts for whichever rows don't have them so every ZolaUIMessage is
// parts-only, per the v5 UIMessage shape.
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
      message_group_id: message.message_group_id ?? undefined,
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

export async function getMessagesFromDb(
  chatId: string,
  limit?: number
): Promise<ZolaUIMessage[]> {
  const qs = limit ? `?limit=${limit}` : ""
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages${qs}`)
  if (!res.ok) return []

  const data: DbMessage[] = await res.json()
  return data.map(fromDbMessage)
}

// Runs after EVERY turn. It used to fetch the entire conversation and slice
// two rows off the end in JavaScript, so a 500-message chat downloaded and
// parsed 500 rows to read 2 -- and got slower with every reply. The tail is
// now cut in SQL.
export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<ZolaUIMessage[]> {
  return getMessagesFromDb(chatId, limit)
}

async function insertMessageToDb(chatId: string, message: ZolaUIMessage) {
  await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: message.role,
      content: textFromMessage(message),
      experimental_attachments: attachmentsFromMessage(message),
      createdAt: message.metadata?.createdAt,
      message_group_id: message.metadata?.message_group_id || null,
      model: message.metadata?.model || null,
    }),
  })
}

async function insertMessagesToDb(chatId: string, messages: ZolaUIMessage[]) {
  await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: textFromMessage(message),
        experimental_attachments: attachmentsFromMessage(message),
        createdAt: message.metadata?.createdAt,
        message_group_id: message.metadata?.message_group_id || null,
        model: message.metadata?.model || null,
      })),
    }),
  })
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

export async function addMessage(
  chatId: string,
  message: ZolaUIMessage
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: ZolaUIMessage[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
