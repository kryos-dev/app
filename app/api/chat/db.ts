import type { Message } from "@/app/types/api.types"
import { db, schema } from "@/lib/db"

// v5 UIMessage parts arrive already deduplicated/reconstructed by
// createUIMessageStream's onFinish (one entry per text/reasoning block or
// toolCallId), so this just concatenates text parts for the plain-text
// `content` column and stores the parts array verbatim as jsonb.
function stripNul<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("\u0000", "") as T
  if (Array.isArray(value)) return value.map(stripNul) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripNul(v)])
    ) as T
  }
  return value
}

export async function saveFinalAssistantMessage(
  chatId: string,
  messages: Message[],
  message_group_id?: string,
  model?: string,
  // When the turn STARTED, not when it finished. An interrupted (or
  // navigated-away-from) reply keeps generating server-side and can land
  // minutes later, after the next question was already saved -- which sorts
  // the answer below a message it never saw and reads as history scrambling.
  createdAt?: Date
) {
  const assistantMsg = messages.find((m) => m.role === "assistant")
  // Postgres jsonb rejects \u0000; tool output (binary, terminal control
  // sequences) can carry it, and one NUL used to lose the whole reply.
  const parts = stripNul(assistantMsg?.parts ?? []) as NonNullable<Message["parts"]>

  const finalPlainText = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text || "")
    .join("\n\n")

  await db.insert(schema.messages).values({
    chatId,
    role: "assistant",
    content: finalPlainText || "",
    parts,
    messageGroupId: message_group_id,
    model,
    ...(createdAt ? { createdAt } : {}),
  })
}
