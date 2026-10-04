// node --import tsx lib/title.test.ts
// Pure helpers only: the db and model calls in lib/title.ts are not touched.
import assert from "node:assert/strict"
import test from "node:test"
import { cleanTitle, isPlaceholderTitle, titleFromMessage } from "./title-text"

test("a title the client invented is ours to replace", () => {
  const msg = "Explain the project layout to me please"
  assert.equal(isPlaceholderTitle(null, msg), true)
  assert.equal(isPlaceholderTitle("", msg), true)
  assert.equal(isPlaceholderTitle("New Chat", msg), true)
  // The client truncates the first message, with and without an ellipsis.
  assert.equal(isPlaceholderTitle("Explain the project layout…", msg), true)
  assert.equal(isPlaceholderTitle(msg, msg), true)
})

test("a generated or hand-written title is left alone", () => {
  const msg = "Explain the project layout to me please"
  assert.equal(isPlaceholderTitle("Project layout walkthrough", msg), false)
  assert.equal(isPlaceholderTitle("Q3 planning", msg), false)
})

test("model answers are cleaned up", () => {
  assert.equal(cleanTitle('"Project layout walkthrough."'), "Project layout walkthrough")
  assert.equal(cleanTitle("Title: Deploy pipeline fix"), "Deploy pipeline fix")
  assert.equal(cleanTitle("<think>hmm, six words</think>\nDeploy pipeline fix"), "Deploy pipeline fix")
  assert.equal(cleanTitle("  \n  Voice latency tuning \n more"), "Voice latency tuning")
  assert.equal(cleanTitle(""), "")
})

test("title is the first line, capped at 60 characters", () => {
  assert.equal(titleFromMessage("\n  Fix the build  \nthen deploy"), "Fix the build")
  assert.equal(titleFromMessage(""), "")
  const long = titleFromMessage("x".repeat(100))
  assert.equal(long.length, 60)
  assert.ok(long.endsWith("…"))
})
