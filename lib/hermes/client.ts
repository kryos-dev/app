import { readBlob } from "@/lib/blobs"
import type { UIMessage } from "ai"

/** The virtual model id meaning "whatever the agent is configured with". */
export const AGENT_DEFAULT = "hermes-agent"

/** A picked model travels as one id: "<provider slug>|<model>". */
export const MODEL_ID_SEP = "|"

export function encodeModelId(provider: string, model: string): string {
  return `${provider}${MODEL_ID_SEP}${model}`
}

export function decodeModelId(
  id: string | undefined
): { provider: string; model: string } | null {
  if (!id || id === AGENT_DEFAULT) return null
  const i = id.indexOf(MODEL_ID_SEP)
  if (i <= 0 || i === id.length - 1) return null
  return { provider: id.slice(0, i), model: id.slice(i + 1) }
}

// The gateway skips image data larger than this and caps the whole request at
// 10 MB, so bigger images are left out rather than failing the turn.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }

const BLOB_URL_PREFIX = "/api/files/"

// The new user turn as Responses input. Images are inlined as data URLs (the
// endpoint accepts only text and image parts); any other file is named in the
// text by its path on the Hermes host so the agent opens it with its own tools.
async function userTurnInput(
  message: UIMessage
): Promise<string | [{ role: "user"; content: InputPart[] }]> {
  let text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
  const images: InputPart[] = []
  const hostDir = (process.env.BLOB_HOST_DIR ?? "").replace(/\/+$/, "")

  for (const part of message.parts) {
    if (part.type !== "file") continue
    const id = part.url.startsWith(BLOB_URL_PREFIX)
      ? part.url.slice(BLOB_URL_PREFIX.length)
      : null
    const blob = id ? await readBlob(id) : null
    if (part.mediaType?.startsWith("image/")) {
      if (blob && blob.bytes.length <= MAX_IMAGE_BYTES) {
        images.push({
          type: "input_image",
          image_url: `data:${blob.contentType};base64,${blob.bytes.toString("base64")}`,
        })
      } else if (part.url.startsWith("data:image/") || /^https?:/.test(part.url)) {
        images.push({ type: "input_image", image_url: part.url })
      }
    } else if (blob) {
      text += `${text ? "\n" : ""}Attached file: ${hostDir}/${blob.storedName} (${
        part.filename || blob.name
      }, ${part.mediaType || blob.contentType})`
    }
  }

  if (!images.length) return text
  return [
    {
      role: "user",
      content: [...(text ? [{ type: "input_text" as const, text }] : []), ...images],
    },
  ]
}

type HermesRequestArgs = {
  /** The new user message; earlier turns live in the Hermes session. */
  message: UIMessage
  /** Zola model id; "hermes-agent" or empty means the agent's own default. */
  model?: string
  chatId: string
  systemPrompt?: string
  /** none | low | medium | high | max, see lib/thinking-effort.ts */
  reasoningEffort: string
  signal?: AbortSignal
}

// POSTs to the gateway's `/v1/responses` (stream: true) and returns the raw
// Response for hermesResponsesToUIMessageStream. One Hermes session per chat,
// keyed by chat id, so the gateway continues the conversation itself.
export async function hermesRequest({
  message,
  model,
  chatId,
  systemPrompt,
  reasoningEffort,
  signal,
}: HermesRequestArgs): Promise<Response> {
  const picked = decodeModelId(model)
  const res = await fetch(`${process.env.HERMES_API_URL}/v1/responses`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HERMES_API_KEY}`,
      "X-Hermes-Session-Key": chatId,
    },
    body: JSON.stringify({
      stream: true,
      instructions: systemPrompt,
      input: await userTurnInput(message),
      model_options: { reasoning_effort: reasoningEffort },
      // An explicit provider is always honored by the gateway; a bare model
      // would be dropped.
      ...(picked ? { model: picked.model, provider: picked.provider } : {}),
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(`Hermes agent request failed (${res.status}): ${text}`)
  }
  return res
}
