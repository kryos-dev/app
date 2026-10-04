/**
 * The in-flight turn for a chat, so the Stop button can actually stop it.
 *
 * Aborting the browser's fetch does not stop anything on this side: the route
 * deliberately keeps a tee'd copy of the stream alive (`consumeSseStream`) so a
 * reply survives navigating away, and Hermes runs its own agent loop on the VM
 * regardless of who is listening. So pressing Stop used to end the turn in the
 * UI only -- the model kept generating, kept spending, and then persisted a
 * reply LONGER than the one the user saw, so the chat changed under them on the
 * next reload.
 *
 * Registering the turn's AbortController here gives `/api/chat/abort` something
 * to pull. Aborting it cancels the upstream request to Hermes, which
 * ends the SSE stream, which runs the normal onFinish path -- so whatever had
 * been generated at that point is persisted, and the database agrees with what
 * is on screen.
 *
 * ponytail: a module-level Map, because the box runs one Next process. If Zola
 * is ever scaled past one instance the abort has to reach the instance holding
 * the run through shared state.
 */

type Run = {
  controller: AbortController
}

const runs = new Map<string, Run>()

/** Start tracking a turn. Any previous turn for the chat is aborted first. */
export function beginRun(chatId: string): Run {
  abortRun(chatId)
  const run: Run = { controller: new AbortController() }
  runs.set(chatId, run)
  return run
}

/** Abort the chat's in-flight turn, if there is one. True when one was aborted. */
export function abortRun(chatId: string): boolean {
  const run = runs.get(chatId)
  if (!run) return false
  runs.delete(chatId)
  run.controller.abort()
  return true
}

/** Stop tracking a turn, but only if `run` is still the current one. */
export function endRun(chatId: string, run: Run): void {
  if (runs.get(chatId) === run) runs.delete(chatId)
}

export type { Run }
