/**
 * The thinking-effort lever, in one place because both ends need it: the
 * slider in the composer and the route that forwards the choice to a runtime.
 *
 * Every value is one Hermes accepts verbatim. Its
 * gateway/platforms/api_server.py `_REASONING_EFFORTS` is
 *   {none, minimal, low, medium, high, xhigh, max, ultra}
 * and `_request_reasoning_config` IGNORES an effort outside that set rather
 * than rejecting it -- a typo here would be a silently dead slider, so the
 * rungs are spelled its way, not ours.
 *
 * There is no "auto": it meant "send no override and let the runtime decide",
 * so two identical questions could think for different lengths with nothing in
 * the UI to explain it. Every turn states an effort.
 */

export const THINKING_LEVELS = [
  { value: "none", label: "Instant", hint: "No thinking" },
  { value: "low", label: "Low", hint: "A little thinking" },
  { value: "medium", label: "Medium", hint: "Balanced" },
  { value: "high", label: "High", hint: "Thinks it through" },
  { value: "max", label: "Max", hint: "Thinks hardest" },
] as const

export type ThinkingEffort = (typeof THINKING_LEVELS)[number]["value"]

export const THINKING_EFFORTS: readonly string[] = THINKING_LEVELS.map((l) => l.value)

/** The slider's default, and what anything unrecognised resolves to. */
export const THINKING_EFFORT_DEFAULT: ThinkingEffort = "low"

export const THINKING_EFFORT_STORAGE_KEY = "zola:reasoning-effort"

/**
 * Map any stored or client-supplied value onto a rung that exists.
 * Covers the values this picker used to offer ("auto", "xhigh") so an old
 * preference in localStorage does not strand the slider off its own scale.
 */
export function normalizeThinkingEffort(
  value: string | null | undefined
): ThinkingEffort {
  if (value === "xhigh" || value === "ultra") return "max"
  if (value === "minimal") return "none"
  return (THINKING_LEVELS.find((l) => l.value === value)?.value ??
    THINKING_EFFORT_DEFAULT) as ThinkingEffort
}
