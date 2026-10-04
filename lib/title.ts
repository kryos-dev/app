import { db, schema } from "@/lib/db"
import { cleanTitle, isPlaceholderTitle } from "@/lib/title-text"
import { eq } from "drizzle-orm"

const SYSTEM =
  "Write a chat title of at most 6 words for the conversation. Plain words only: no quotes, no trailing period, no markdown."

// One non-streaming gateway turn on the agent's default model, once per chat.
async function viaHermes(prompt: string, chatId: string): Promise<string> {
  const res = await fetch(`${process.env.HERMES_API_URL}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HERMES_API_KEY}`,
      // Per chat, not one shared "zola-title-gen" session: that one session
      // accumulated every title request ever made, so each new title cost
      // the whole history of the previous ones.
      "X-Hermes-Session-Key": `title-${chatId}`,
    },
    body: JSON.stringify({
      stream: false,
      model_options: { reasoning_effort: "none" },
      instructions: SYSTEM,
      input: prompt,
    }),
  })
  if (!res.ok) throw new Error(`Hermes title request failed (${res.status})`)
  const json = (await res.json()) as {
    output_text?: string
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  }
  return (
    json.output_text ??
    json.output
      ?.filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .find((c) => c.type === "output_text")?.text ??
    ""
  )
}

// After the first exchange, replace the placeholder title with a short
// generated one (ChatGPT-style). Runs once per chat.
export async function maybeGenerateTitle({
  chatId,
  userText,
  assistantText,
}: {
  chatId: string
  userText: string
  assistantText: string
}): Promise<void> {
  if (!userText.trim()) return
  // Counting rows was the old guard ("2 messages means first exchange"), and
  // it was wrong the moment a reply persisted more than one row -- an answer
  // with tool calls left every chat on its placeholder forever. What actually
  // decides this is whether the title is still a placeholder.
  const [chat] = await db
    .select({ title: schema.chats.title })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  if (!chat || !isPlaceholderTitle(chat.title, userText)) return

  const prompt = `User: ${userText.slice(0, 1500)}\n\nAssistant: ${assistantText.slice(0, 1500)}`
  // A title is cosmetic: failing here must not matter to the caller.
  let text = ""
  try {
    text = await viaHermes(prompt, chatId)
  } catch (err) {
    console.warn("Title via Hermes failed:", (err as Error).message)
    return
  }
  const title = cleanTitle(text)
  if (!title) return
  await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
}
