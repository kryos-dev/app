import type { ComponentType } from "react"
import { FileTool } from "./file-tool"
import { MediaTool } from "./media-tool"
import { PlanTool } from "./plan-tool"
import { SummaryTool } from "./summary-tool"
import { TerminalTool } from "./terminal-tool"
import type { ToolBodyProps } from "./tool-shell"
import { WebTool } from "./web-tool"

const RENDERERS: Record<string, ComponentType<ToolBodyProps>> = {
  terminal: TerminalTool,
  execute_code: TerminalTool,
  process_manage: TerminalTool,
  read_file: FileTool,
  write_file: FileTool,
  patch: FileTool,
  search_files: FileTool,
  web_search: WebTool,
  web_extract: WebTool,
  browser_navigate: WebTool,
  vision_analyze: MediaTool,
  image_generate: MediaTool,
  delegate_task: SummaryTool,
  memory: SummaryTool,
  todo_list: PlanTool,
  cronjob_manage: SummaryTool,
  session_search: SummaryTool,
  manage_connections: SummaryTool,
}

export function getToolRenderer(toolName: string): ComponentType<ToolBodyProps> | undefined {
  if (RENDERERS[toolName]) return RENDERERS[toolName]
  if (toolName.startsWith("skill_")) return SummaryTool
  return undefined
}
