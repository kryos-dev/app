import type { Attachment } from "@/lib/file-handling"

// v5 UIMessage part shapes (subset we actually persist). Tool parts use the
// `tool-<name>` discriminated type AI SDK v5 puts on UIMessage["parts"].
export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

export interface Message {
  role: "user" | "assistant" | "system"
  parts: ContentPart[]
}

export interface ChatApiParams {
  userId: string
}

export interface LogUserMessageParams {
  userId: string
  chatId: string
  content: string
  attachments?: Attachment[]
  model: string
  message_group_id?: string
  /** Explicit so the reply can be stamped just after it; see app/api/chat/route.ts. */
  createdAt?: Date
}

export interface StoreAssistantMessageParams {
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
