import assert from "node:assert/strict"
import { mergeDictation, recordingFormat } from "./dictation"

// Chrome / Android: webm with opus wins.
assert.deepEqual(recordingFormat((t) => t.startsWith("audio/webm")), {
  mimeType: "audio/webm;codecs=opus",
  ext: "webm",
})
// iOS Safari: only mp4, and the file must be named .mp4 to match.
assert.deepEqual(recordingFormat((t) => t === "audio/mp4"), { mimeType: "audio/mp4", ext: "mp4" })
// Nothing supported, or no MediaRecorder at all (node): no button.
assert.equal(recordingFormat(() => false), null)
assert.equal(recordingFormat(undefined), null)

// Merging with what was already typed.
assert.equal(mergeDictation("", "hello there "), "hello there")
assert.equal(mergeDictation("note:", "buy milk"), "note: buy milk")
assert.equal(mergeDictation("note: ", "buy milk"), "note: buy milk")
// Silence must not append a stray space to what the person typed.
assert.equal(mergeDictation("unchanged", "   "), "unchanged")

console.log("dictation: ok")
