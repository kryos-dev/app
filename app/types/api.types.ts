
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

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
