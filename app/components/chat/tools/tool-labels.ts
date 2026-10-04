type ToolLabelEntry = { label: string; running: string }

// Fixed verb-phrase label per Hermes tool name, adopted from Coder's
// ToolLabel/displayMode pattern: a static past-tense label for the
// completed row, and a present-continuous variant shown (with a shimmer)
// while the call is still running.
const TOOL_LABELS: Record<string, ToolLabelEntry> = {
  terminal: { label: "Ran command", running: "Running command…" },
  execute_code: { label: "Ran code", running: "Running code…" },
  process_manage: { label: "Managed process", running: "Managing process…" },
  read_file: { label: "Read file", running: "Reading file…" },
  write_file: { label: "Wrote file", running: "Writing file…" },
  patch: { label: "Edited file", running: "Editing file…" },
  search_files: { label: "Searched files", running: "Searching files…" },
  web_search: { label: "Searched the web", running: "Searching the web…" },
  web_extract: { label: "Read page", running: "Reading page…" },
  browser_navigate: { label: "Opened page", running: "Opening page…" },
  vision_analyze: { label: "Looked at image", running: "Looking at image…" },
  image_generate: { label: "Generated image", running: "Generating image…" },
  delegate_task: { label: "Delegated task", running: "Delegating task…" },
  memory: { label: "Updated memory", running: "Updating memory…" },
  todo_list: { label: "Updated todo", running: "Updating todo…" },
  skill_view: { label: "Used skill", running: "Using skill…" },
  skills_list: { label: "Used skill", running: "Using skill…" },
  skill_manage: { label: "Used skill", running: "Using skill…" },
  cronjob_manage: { label: "Scheduled job", running: "Scheduling job…" },
  session_search: { label: "Searched sessions", running: "Searching sessions…" },
}

export function getToolLabel(toolName: string, running: boolean): string {
  const entry = TOOL_LABELS[toolName]
  if (!entry) return toolName
  return running ? entry.running : entry.label
}

// Short argument shown next to the label in the row header (command, path,
// query or URL), so a collapsed row still says what the call did.
export function getToolSummary(input: unknown): string | undefined {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const v =
    i.command ?? i.code ?? i.path ?? i.file_path ?? i.filePath ?? i.query ?? i.url ?? i.pattern
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}
