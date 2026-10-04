import { chatOwnerId } from "@/lib/auth/guards"
import { canvasSystemPromptAddendum } from "@/lib/canvas/prompt"
import { adoptHermesTitle } from "@/lib/title"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { projectContext } from "@/lib/projects/context"
import { ensureHermesSession, hermesRequest } from "@/lib/hermes/client"
import { hermesSessionStreamToUIMessageStream } from "@/lib/hermes/stream"
import { beginRun, endRun, type Run } from "@/lib/runs"
import { THINKING_EFFORTS, THINKING_EFFORT_DEFAULT } from "@/lib/thinking-effort"
import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { createUIMessageStreamResponse, type UIMessage } from "ai"
import { eq } from "drizzle-orm"
import { incrementMessageCount, validateAndTrackUsage } from "./api"
import { createErrorResponse } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: UIMessage[]
  chatId: string
  model: string
  systemPrompt: string
  /** Thinking slider rung; see lib/thinking-effort.ts. Anything unknown
   *  becomes the default rung -- there is no "let the runtime decide". */
  reasoningEffort?: string
  /** Set by the client when a canvas tab is active; triggers the ```canvas protocol addendum below. */
  canvasId?: string
  canvasTitle?: string
}

// Hermes stores the turn itself; what is left to do when it ends is releasing
// the run and titling the chat.
async function finishTurn({
  chatId,
  sessionId,
  userText,
  run,
}: {
  chatId: string
  sessionId: string
  userText: string
  run: Run
}) {
  endRun(chatId, run)
  try {
    await adoptHermesTitle({ chatId, sessionId, userText })
  } catch (err) {
    console.error("Title generation failed:", err)
  }
}

// The instructions of the project this chat belongs to, if it belongs to one,
// plus the text of that project's uploaded files (see lib/projects/context.ts
// -- this is the part that makes "projects" hold files, not just a prompt).
// One join rather than two round trips for the project row itself, and null
// for every chat that does not belong to one.
async function projectPromptFor(chatId: string): Promise<string | null> {
  const [row] = await db
    .select({
      projectId: schema.projects.id,
      systemPrompt: schema.projects.systemPrompt,
    })
    .from(schema.chats)
    .innerJoin(schema.projects, eq(schema.chats.projectId, schema.projects.id))
    .where(eq(schema.chats.id, chatId))
  if (!row) return null

  const instructions = row.systemPrompt?.trim() || ""
  const filesBlock = await projectContext(row.projectId)
  const combined = `${instructions}${filesBlock}`.trim()
  return combined || null
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })
    }
    const userId = user.id

    const {
      messages,
      chatId,
      model,
      systemPrompt,
      reasoningEffort,
      canvasId,
      canvasTitle,
    } = (await req.json()) as ChatRequest

    // The picker's rungs are Hermes' own vocabulary (see
    // thinking-effort-select.tsx), forwarded unchanged.
    //
    // There is no "auto" and no path that sends no override at all: omitting
    // the field made identical requests think for different lengths with
    // nothing in the UI to say why. An
    // unknown or missing value -- an older client, a stale stored preference,
    // the literal string "auto" -- resolves to the default rung instead of
    // disappearing.
    const effort = THINKING_EFFORTS.includes(reasoningEffort ?? "")
      ? (reasoningEffort as string)
      : THINKING_EFFORT_DEFAULT
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const lastUserText =
      lastUser?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? ""

    if (!messages || !chatId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    // One check for the whole turn: proving the chat belongs to the caller
    // here covers everything below that acts on it by id. An id with no row is
    // let through.
    const owner = await chatOwnerId(chatId)
    if (owner && owner !== userId) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
      })
    }

    await validateAndTrackUsage({ userId })
    await incrementMessageCount({ userId })

    const userMessage = messages[messages.length - 1]

    // A chat in a project inherits the project's instructions. Resolved here
    // rather than in the client: the promise is that every chat in the project
    // has them, and a client that forgets to send them is not a reason for a
    // turn to run without them. The chat's own prompt still applies on top.
    const projectInstructions = await projectPromptFor(chatId)

    // Canvas protocol is always on so a first "write me a doc" request can
    // open a canvas; the title hint is added only while one is open.
    // user.systemPrompt before the built-in default, for the same reason the
    // project instructions above are resolved here: the promise is that the
    // user's own prompt applies, and a client that forgets to send it is not a
    // reason for the turn to run as stock Zola.
    const effectiveSystemPrompt = `${projectInstructions ? `${projectInstructions}\n\n` : ""}${systemPrompt || user.systemPrompt?.trim() || SYSTEM_PROMPT_DEFAULT}

${canvasSystemPromptAddendum(canvasId ? canvasTitle : undefined)}`

    // Everything from here on is the turn itself, and it is now interruptible:
    // `beginRun` also aborts whatever was still running for this chat, so a
    // second question asked mid-answer replaces the first instead of racing it
    // (two turns on one `X-Hermes-Session-Key` is what wedged the session and
    // left the chat unable to answer anything at all).
    const run = beginRun(chatId)

    // The chat's Hermes session holds the conversation, so only the newest
    // message is sent.
    const sessionId = await ensureHermesSession(chatId)
    const hermesRes = await hermesRequest({
      message: userMessage,
      model,
      chatId,
      sessionId,
      systemPrompt: effectiveSystemPrompt,
      reasoningEffort: effort,
      // What makes Stop mean stop: aborting this cancels the request to
      // Hermes, which ends the SSE below, which runs onFinish -- so the
      // partial answer is saved and the database matches the screen.
      signal: run.controller.signal,
    }).catch((err) => {
      endRun(chatId, run)
      throw err
    })

    const stream = hermesSessionStreamToUIMessageStream(
      hermesRes.body as ReadableStream<Uint8Array>,
      {
        onFinish: () =>
          finishTurn({ chatId, sessionId, userText: lastUserText, run }),
      }
    )

    // Drain a tee'd copy of the SSE stream server-side so the run (and its
    // onFinish persistence) completes even when the browser navigates away
    // mid-reply; the tee's other branch is what the client cancels.
    return createUIMessageStreamResponse({
      stream,
      consumeSseStream: ({ stream }) =>
        stream.pipeTo(new WritableStream()).catch(() => {}),
    })
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
