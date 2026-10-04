export type CanvasSegment =
  | { kind: "text"; text: string }
  | { kind: "canvas"; title: string; content: string; complete: boolean }

const OPEN_RE = /```canvas(?:\s+title="([^"]*)")?\s*\n/
const FENCE_RE = /^```/gm

// The document itself may contain ``` code blocks, so the first bare fence
// is not the end. The canvas closes at the LAST bare fence line that has no
// further fence after it; while a later fence exists (streaming, or a nested
// block still open) the canvas is still being written.
// ponytail: prose + a code block after the canvas gets swallowed into it;
// the prompt asks for ~~~ fences inside the document to keep this simple.
function findClose(body: string): number {
  let last = -1
  for (const m of body.matchAll(FENCE_RE)) {
    const lineEnd = body.indexOf("\n", m.index)
    const line = body.slice(m.index, lineEnd === -1 ? undefined : lineEnd)
    last = /^```\s*$/.test(line) ? m.index : -1
  }
  if (last === -1) return -1
  // Fence at the very start closes an empty document; otherwise step back
  // over the newline that precedes the closing fence line.
  return last === 0 ? 0 : last - 1
}

/**
 * Splits assistant text into plain-text and canvas segments. Handles a
 * still-streaming (unclosed) canvas fence by returning it as an incomplete
 * segment with whatever content has arrived so far.
 */
export function parseCanvasSegments(text: string): CanvasSegment[] {
  const segments: CanvasSegment[] = []
  let rest = text

  for (;;) {
    const match = OPEN_RE.exec(rest)
    if (!match) {
      if (rest) segments.push({ kind: "text", text: rest })
      break
    }

    const before = rest.slice(0, match.index)
    if (before) segments.push({ kind: "text", text: before })

    const afterOpen = rest.slice(match.index + match[0].length)
    const closeIdx = findClose(afterOpen)
    const title = match[1] ?? "Untitled"

    if (closeIdx === -1) {
      segments.push({ kind: "canvas", title, content: afterOpen, complete: false })
      break
    }

    segments.push({
      kind: "canvas",
      title,
      content: afterOpen.slice(0, closeIdx),
      complete: true,
    })
    rest = afterOpen.slice(closeIdx + "\n```".length)
    // Drop a single leading newline left by the closing fence line.
    if (rest.startsWith("\n")) rest = rest.slice(1)
  }

  return segments
}
