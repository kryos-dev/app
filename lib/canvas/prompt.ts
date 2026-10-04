// Canvas protocol: the agent authors/updates a document by returning it
// inside a fenced ```canvas block containing the FULL document in markdown.
// Runtime-agnostic — this is plain system-prompt text, so it works with any
// agent (Hermes or a plain model) that reads its system prompt.
export const CANVAS_PROTOCOL = `You have access to a canvas: a document panel next to the chat, shown to the user as a card and an editor tab.

To create or update the canvas document, output a fenced code block with the language "canvas" and a title attribute, containing the FULL document in markdown:

\`\`\`canvas title="<title>"
<the complete document, in markdown>
\`\`\`

Rules:
- Always include the ENTIRE document in the block, not a diff or excerpt — it replaces whatever is currently in the canvas.
- Only one canvas block per reply.
- Do not add anything else to the protocol: no extra commentary inside the fence, no code fences other than "canvas" for the document itself.
- Inside the document, write code blocks with ~~~ fences (not backticks), so they cannot be mistaken for the end of the canvas block.
- You may still write normal prose before or after the block.`

export function canvasSystemPromptAddendum(currentTitle?: string): string {
  if (!currentTitle) return CANVAS_PROTOCOL
  return `${CANVAS_PROTOCOL}\n\nThe canvas currently open is titled "${currentTitle}". Keep using that title unless the user asks to rename it.`
}
