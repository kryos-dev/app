// Shapes follow .claude/docs/hermes-client-contracts.md; unverified fields are optional.

export type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';

export interface ModelOptions {
  reasoning_effort?: Effort;
  reasoning?: { enabled: boolean; effort?: string };
  service_tier?: string;
  fast?: boolean;
}

// contracts 3.1
export interface Session {
  id: string;
  source: string;
  user_id?: string;
  model: string;
  title?: string | null;
  started_at: number;
  ended_at?: number;
  end_reason?: string;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  last_active?: number;
  preview?: string;
  parent_session_id?: string;
  pinned: boolean;
  archived: boolean;
  hidden: boolean;
}

export interface Message {
  id: number;
  session_id: string;
  role: string;
  content?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; function: { name: string; arguments: string }; type?: string }[];
  tool_name?: string;
  timestamp?: number;
  finish_reason?: string;
  reasoning?: string;
  reasoning_content?: string;
  display_kind?: string;
}

export interface ListEnvelope<T> {
  object: 'list';
  data: T[];
  limit?: number;
  offset?: number;
  has_more?: boolean;
}

// contracts 2.4 / 2.5
export type OutputItem =
  | { id?: string; type: 'message'; role: 'assistant'; status?: string; content: { type: 'output_text'; text: string }[] }
  | { id: string; type: 'reasoning'; status: string; summary: { type: 'summary_text'; text: string }[] }
  | { id: string; type: 'function_call'; status: string; name: string; call_id: string; arguments: string }
  | { id: string; type: 'function_call_output'; call_id: string; output: { type: 'input_text'; text: string }[]; status: string }
  | { id?: string; type: 'commentary'; status?: string; [k: string]: unknown };

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
export interface Envelope {
  id: string;
  object: 'response';
  status: 'in_progress' | 'completed' | 'incomplete' | 'failed';
  created_at: number;
  model: string;
  output: OutputItem[];
  usage?: Usage;
  error?: unknown;
}

export type SseEvent = { sequence_number?: number } & (
  | { type: 'response.created'; response: Envelope }
  | { type: 'response.output_item.added'; output_index: number; item: OutputItem }
  | { type: 'response.output_item.done'; output_index: number; item: OutputItem }
  | { type: 'response.output_text.delta'; item_id: string; output_index: number; content_index: number; delta: string }
  | { type: 'response.output_text.done'; item_id: string; output_index: number; content_index: number; text: string }
  | { type: 'response.reasoning_summary_part.added'; item_id: string; output_index: number; summary_index: number; part: unknown }
  | { type: 'response.reasoning_summary_part.done'; item_id: string; output_index: number; summary_index: number; part: unknown }
  | { type: 'response.reasoning_summary_text.delta'; item_id: string; output_index: number; summary_index: number; delta: string }
  | { type: 'response.reasoning_summary_text.done'; item_id: string; output_index: number; summary_index: number; text: string }
  | { type: 'response.completed'; response: Envelope }
  | { type: 'response.failed'; response: Envelope }
  | { type: 'hermes.status'; [k: string]: unknown }
);

export interface ResponsesRequest {
  input: string | Array<string | { role: string; content: string | object }>;
  previous_response_id?: string | null;
  model_options?: ModelOptions;
}

// contracts 4
export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  usage?: unknown;
  provenance?: 'hub' | 'bundled' | 'external' | 'agent';
}
export interface HubSkill {
  name: string;
  description: string;
  source: string;
  identifier: string;
  trust_level: string;
  repo?: string;
  tags: string[];
  category: string;
  installed: boolean;
}
export interface ActionStart {
  action: string;
  log_url?: string;
}

// contracts 5
export interface McpServer {
  name: string;
  transport: 'http' | 'stdio';
  url?: string;
  command?: string;
  args: string[];
  env: Record<string, string>;
  auth?: 'none' | 'oauth' | 'header';
  enabled: boolean;
  tools?: unknown;
  source: 'plugin' | 'config';
  plugin?: string;
}
export interface McpFlow {
  flow_id: string;
  server_name: string;
  status: 'starting' | 'authorization_required' | 'approved' | 'error';
  authorization_url?: string;
  error?: string;
  tools?: { name: string; description?: string }[];
}
export interface McpTestResult {
  ok: boolean;
  error?: string;
  tools: { name: string; description?: string; schema_chars?: number }[];
}

// Job record from /api/cron/jobs; every field may be absent on legacy records.
export interface CronJob {
  id?: string;
  name?: string;
  prompt?: string;
  schedule?: unknown;
  schedule_display?: string;
  skills?: string[];
  script?: string;
  enabled?: boolean;
  state?: string;
  paused_reason?: string;
  deliver?: string;
  repeat?: unknown;
  last_run_at?: string | null;
  next_run_at?: string | null;
  model?: string;
  provider?: string;
  workdir?: string;
  no_agent?: boolean;
}

export interface CronJobCreate {
  schedule: string;
  name?: string;
  prompt?: string;
  deliver?: string;
  paused?: boolean;
  paused_reason?: string;
  skills?: string[];
  model?: string;
  provider?: string;
  base_url?: string;
  script?: string;
  context_from?: string[];
  enabled_toolsets?: string[];
  workdir?: string;
  no_agent?: boolean;
}

// contracts 7
export interface MemoryState {
  active: string | null;
  providers: unknown;
  builtin_files: { memory: unknown; user: unknown };
}
export interface MemoryProviderField {
  key: string;
  label: string;
  kind: 'secret' | 'select' | 'bool' | 'number' | 'json' | 'text';
  description?: string;
  value?: unknown;
  is_set?: boolean;
}
export interface MemoryProviderConfig {
  name: string;
  label: string;
  docs_url?: string;
  fields: MemoryProviderField[];
}

// contracts 8
export interface EnvVar {
  is_set: boolean;
  redacted_value?: string | null;
  description?: string;
  url?: string;
  category?: string;
  is_password?: boolean;
  advanced?: boolean;
  provider?: string;
  [k: string]: unknown;
}
export interface ModelProvider {
  slug: string;
  label: string;
  models: unknown[];
}
export interface ModelOptionsResponse {
  categories?: unknown;
  providers: ModelProvider[];
}
