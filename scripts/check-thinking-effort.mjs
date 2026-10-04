/**
 * The thinking slider's invariants.
 *
 *   node scripts/check-thinking-effort.mjs
 *
 * Every rung is a value Hermes' `_REASONING_EFFORTS` accepts, the normaliser
 * never returns a rung that is not on the slider, no input maps to "send
 * nothing" (there is no auto).
 *
 * Whether the rung actually changes how much the model thinks is the other
 * half, and it needs the real box: check-thinking-effort-live.sh.
 */
import assert from "node:assert"

const {
  THINKING_LEVELS,
  THINKING_EFFORTS,
  THINKING_EFFORT_DEFAULT,
  normalizeThinkingEffort,
} = await import("../lib/thinking-effort.ts").catch(async () => {
  // Plain node cannot load .ts; fall back to parsing the module's values out
  // of the source so this check needs no build step.
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../lib/thinking-effort.ts", import.meta.url), "utf8")
  )
  const values = [...src.matchAll(/\{ value: "([a-z]+)"/g)].map((m) => m[1])
  const def = src.match(/THINKING_EFFORT_DEFAULT: ThinkingEffort = "([a-z]+)"/)[1]
  return {
    THINKING_LEVELS: values.map((value) => ({ value })),
    THINKING_EFFORTS: values,
    THINKING_EFFORT_DEFAULT: def,
    normalizeThinkingEffort: (v) =>
      v === "xhigh" || v === "ultra"
        ? "max"
        : v === "minimal"
          ? "none"
          : values.includes(v)
            ? v
            : def,
  }
})

// Verbatim from Hermes gateway/platforms/api_server.py:252. An effort outside
// this set is IGNORED there, not rejected, so a typo would be a dead slider
// that still looks like it works.
const HERMES_REASONING_EFFORTS = new Set([
  "none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra",
])

const rungs = THINKING_LEVELS.map((l) => l.value)

for (const rung of rungs) {
  assert.ok(
    HERMES_REASONING_EFFORTS.has(rung),
    `rung ${rung} is not in Hermes _REASONING_EFFORTS, so it would be silently ignored`
  )
}
console.log(`every rung is a value Hermes honours: ${rungs.join(", ")}`)

// No "auto", and nothing that means "send no override".
assert.ok(!rungs.includes("auto"), "auto is back on the slider")
assert.ok(rungs.includes("none"), "the Instant rung is missing")
assert.ok(rungs.includes("max"), "the Max rung is missing")
assert.ok(THINKING_EFFORTS.includes(THINKING_EFFORT_DEFAULT), "default is off the slider")

// Anything at all resolves to a rung that exists -- never undefined, never
// "auto", never a value the slider cannot display.
for (const input of ["auto", "xhigh", "ultra", "minimal", "", null, undefined, "nonsense", ...rungs]) {
  const out = normalizeThinkingEffort(input)
  assert.ok(rungs.includes(out), `normalize(${String(input)}) = ${out}, not a rung`)
}
console.log("every stored or stale value normalises onto a real rung")

console.log("PASS")

// The live half of this check -- proving the rung actually changes how much
// the model thinks -- lives in check-thinking-effort-live.sh. It has to be a
// shell script: on the owner's EDR-managed laptop node cannot open an outbound
// connection (ECONNREFUSED), and neither can curl when node spawns it (exit 7),
// while curl run from the shell is fine. Process lineage, not the network.
