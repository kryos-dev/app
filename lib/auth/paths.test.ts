import assert from "node:assert/strict"
import test from "node:test"
import { isUnder } from "./paths"

test("a path is under a root only at a segment boundary", () => {
  assert.equal(isUnder("/home/ubuntu/projects/a", "/home/ubuntu/projects/a"), true)
  assert.equal(isUnder("/home/ubuntu/projects/a/src/x.ts", "/home/ubuntu/projects/a"), true)
  assert.equal(isUnder("/home/ubuntu/projects/a/", "/home/ubuntu/projects/a"), true)
  assert.equal(isUnder("/home/ubuntu/projects/ab", "/home/ubuntu/projects/a"), false)
  assert.equal(isUnder("/home/ubuntu/.hermes/.env", "/home/ubuntu/projects/a"), false)
  assert.equal(isUnder("/etc/passwd", "/home/ubuntu/projects/a"), false)
})

test("separators and trailing slashes do not change the answer", () => {
  assert.equal(isUnder("C:\\work\\p\\file", "C:/work/p"), true)
  assert.equal(isUnder("/home/u/p/f", "/home/u/p/"), true)
})
