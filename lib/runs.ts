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
 * A second send for the same chat waits for the running turn to end, because
 * Hermes allows one turn per session at a time.
 *
 * Every run also carries a status -- running, complete or failed -- which is
 * what the sidebar dots read. The terminal status survives `endRun` until the
 * chat's next `beginRun`, so a finished turn keeps its green/red dot instead of
 * blinking out the moment the stream closes. It lives in this module too (a
 * module-level Map), because the box runs one Next process. If Zola is ever
 * scaled past one instance the status has to reach the instance holding the
 * run through shared state.
 */

import type { UIMessageChunk } from "ai"

/** The state of a chat's most recent turn, shown as a dot in the sidebar. */
export type RunStatus = "running" | "complete" | "failed"

type Run = {
  controller: AbortController
  /** Settles when the turn ends or is aborted; queued sends wait on it. */
  done: Promise<void>
  /** Ends the run: resolves `done` and closes every subscriber. */
  finish: () => void
  /** Record a UI message stream chunk and pass it to live subscribers. */
  publish: (chunk: UIMessageChunk) => void
  /** Every chunk so far, then the live ones; closes when the run finishes. */
  subscribe: () => ReadableStream<UIMessageChunk>
}

const runs = new Map<string, Run>()

// A chat's most recent turn status. A terminal status is kept after `endRun`
// removes the run so the sidebar can still show it; `beginRun` replaces it.
const statuses = new Map<string, RunStatus>()

// The chunks of one turn are kept so a client whose connection dropped can
// reattach: it gets the buffer replayed, then the rest as it is produced.
function makeBuffer() {
  const chunks: UIMessageChunk[] = []
  const subscribers = new Set<ReadableStreamDefaultController<UIMessageChunk>>()
  let closed = false
  return {
    publish(chunk: UIMessageChunk) {
      if (closed) return
      chunks.push(chunk)
      for (const s of subscribers) s.enqueue(chunk)
    },
    subscribe() {
      let ctrl: ReadableStreamDefaultController<UIMessageChunk>
      return new ReadableStream<UIMessageChunk>({
        start(c) {
          ctrl = c
          for (const chunk of chunks) c.enqueue(chunk)
          if (closed) c.close()
          else subscribers.add(c)
        },
        cancel() {
          subscribers.delete(ctrl)
        },
      })
    },
    close() {
      if (closed) return
      closed = true
      for (const s of subscribers) s.close()
      subscribers.clear()
    },
  }
}

/** Start tracking a turn. Waits for the chat's running turn, if any, to end. */
export async function beginRun(chatId: string): Promise<Run> {
  // A loop, not a single await: when several sends are queued, only the first
  // to wake registers; the rest see its run and keep waiting.
  while (runs.get(chatId)) await runs.get(chatId)!.done
  let finish!: () => void
  const done = new Promise<void>((resolve) => (finish = resolve))
  const buffer = makeBuffer()
  const run: Run = {
    controller: new AbortController(),
    done,
    finish: () => {
      buffer.close()
      finish()
    },
    publish: buffer.publish,
    subscribe: buffer.subscribe,
  }
  runs.set(chatId, run)
  statuses.set(chatId, "running")
  return run
}

/** The chat's running turn, if any. */
export function getRun(chatId: string): Run | undefined {
  return runs.get(chatId)
}

/** Whether a turn is currently running for the chat. */
export function hasRun(chatId: string): boolean {
  return runs.has(chatId)
}

/** The state of the chat's most recent turn; undefined when none has run in
 *  this process's lifetime. The terminal state survives the run being removed. */
export function getRunStatus(chatId: string): RunStatus | undefined {
  return statuses.get(chatId)
}

/**
 * Abort the chat's in-flight turn, if there is one. True when one was aborted.
 * The run stays registered: aborting ends the Hermes stream, the partial reply
 * is saved, and only then does `endRun` release it.
 */
export function abortRun(chatId: string): boolean {
  const run = runs.get(chatId)
  if (!run) return false
  run.controller.abort()
  return true
}

/**
 * Stop tracking a turn, but only if `run` is still the current one. Records
 * the turn's terminal status -- complete or failed -- which is preserved until
 * the chat's next `beginRun`.
 */
export function endRun(chatId: string, run: Run, status: RunStatus): void {
  if (runs.get(chatId) === run) {
    runs.delete(chatId)
    statuses.set(chatId, status)
  }
  run.finish()
}

/**
 * End a run that never produced a turn (a queued send whose client left before
 * it started). No terminal status is recorded, so the chat shows no dot for a
 * turn that never ran.
 */
export function discardRun(chatId: string, run: Run): void {
  if (runs.get(chatId) === run) {
    runs.delete(chatId)
    statuses.delete(chatId)
  }
  run.finish()
}

export type { Run }
