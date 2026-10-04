import assert from "node:assert/strict"
import { chunkForSpeech } from "./speech-chunks"

assert.deepEqual(chunkForSpeech("   "), [], "blank text speaks nothing")
assert.deepEqual(chunkForSpeech("Hello there."), ["Hello there."])

// Short sentences ride together up to the limit; nothing is lost or reordered.
const many = chunkForSpeech("One. Two! Three? Four.", 12)
assert.deepEqual(many, ["One. Two!", "Three? Four."])
assert.equal(many.join(" ").replace(/\s+/g, " "), "One. Two! Three? Four.")

// A sentence longer than a chunk breaks on whitespace, never mid-word.
const long = chunkForSpeech(`${"word ".repeat(40)}end.`, 50)
assert.ok(long.length > 1, "expected the long sentence to be split")
assert.ok(long.every((c) => c.length <= 50), "every chunk fits")
assert.ok(
  long.every((c) => !c.startsWith("ord") && !c.endsWith("wo")),
  "no chunk starts or ends mid-word"
)

// The first chunk is held short (time to first sound); later ones may be long.
const ramped = chunkForSpeech("Aa bb cc. Dd ee ff. Gg hh ii. Jj kk ll.", 40, 12)
assert.deepEqual(ramped, ["Aa bb cc.", "Dd ee ff. Gg hh ii. Jj kk ll."])

// A trailing fragment with no full stop is still spoken.
assert.deepEqual(chunkForSpeech("Done. and then"), ["Done. and then"])

console.log("speech-chunks.test.ts: all assertions passed")
