// Read aloud renders one chunk at a time so the first sentence can play while
// the rest is still being synthesised. Kokoro on our CPU runs at roughly real
// time, so a one-minute answer is a one-minute wait before any sound otherwise.
//
// Chunks end on sentence boundaries where possible: cutting mid-sentence makes
// the joins audible, and each chunk is a separate synthesis with its own
// prosody.
// Kept small on purpose: a chunk takes ~0.6x its own spoken length to
// synthesise, so as long as chunks are similar sizes the next one is ready
// before the current one stops playing. 240 left a 3s silence mid-answer.
const MAX = 140
// The first chunk is the whole wait before any sound, so it is deliberately
// short: measured 9.5s to first audio at 240 chars, and synthesis runs at about
// real time. Later chunks render while the previous one plays, so they can be
// long enough to keep the prosody natural.
const FIRST = 90

export function chunkForSpeech(text: string, max = MAX, first = Math.min(FIRST, max)): string[] {
  const clean = text.trim()
  if (!clean) return []

  // Keep the terminator with its sentence; a trailing fragment (no full stop)
  // is a sentence too.
  const sentences = clean.match(/[^.!?\n]+(?:[.!?]+|\n+|$)/g) ?? [clean]
  const chunks: string[] = []
  let current = ""

  for (const raw of sentences) {
    const sentence = raw.trim()
    if (!sentence) continue
    // Only the chunk that plays first is held short.
    const limit = chunks.length === 0 ? first : max
    if (sentence.length > limit) {
      if (current) { chunks.push(current); current = "" }
      // One sentence longer than a chunk: break it on whitespace rather than
      // mid-word, which Kokoro would pronounce as two half-words.
      for (const piece of sentence.match(new RegExp(`[\\s\\S]{1,${limit}}(?:\\s|$)`, "g")) ?? [sentence]) {
        const trimmed = piece.trim()
        if (trimmed) chunks.push(trimmed)
      }
      continue
    }
    if (!current) current = sentence
    else if (current.length + 1 + sentence.length <= limit) current += ` ${sentence}`
    else { chunks.push(current); current = sentence }
  }
  if (current) chunks.push(current)
  return chunks
}
