// Pure title helpers, kept free of the database so they can be tested alone.

const PLACEHOLDER = "New Chat"

/**
 * Is this title still the one the client invented when it created the chat?
 *
 * The client opens a chat with `title = the first user message` (truncated),
 * or "New Chat" when there is nothing to use. A title is ours to replace
 * while it is still one of those, and nobody's to touch afterwards -- a
 * generated title is never a prefix of the message it came from, and a title
 * the owner typed is not either.
 */
export function isPlaceholderTitle(title: string | null, userText: string): boolean {
  const current = (title ?? "").trim()
  if (!current || current === PLACEHOLDER) return true
  const first = userText.trim()
  if (!first) return false
  // The client truncates, so the stored title can be a prefix of the message
  // (with or without an ellipsis) rather than equal to it.
  const stripped = current.replace(/[.…]+$/, "")
  return first.startsWith(stripped) || stripped.startsWith(first)
}

/**
 * Make a usable title out of whatever the model answered.
 *
 * Small models answer the same handful of ways: wrapped in quotes, prefixed
 * with "Title:", or (reasoning lanes) with a <think> block in front of the
 * answer. Each of those shipped to the sidebar verbatim before.
 */
export function cleanTitle(text: string): string {
  return (
    text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)[0]
      ?.replace(/^title\s*[:\-]\s*/i, "")
      .replace(/^["'“”\s]+|["'“”\s.]+$/g, "")
      .slice(0, 80) ?? ""
  )
}

/** Chat title taken from the first user message: its first line, at most 60 characters. */
export function titleFromMessage(text: string): string {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ""
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line
}
