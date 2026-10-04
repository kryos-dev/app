"use client"

import { Plan, type PlanTodo } from "@/components/tool-ui/plan"
import { parseToolResult, type ToolBodyProps } from "./tool-shell"

type RawTodo = {
  id?: string | number
  content?: string
  label?: string
  status?: string
}

const STATUSES = new Set(["pending", "in_progress", "completed", "cancelled"])

function toTodos(raw: unknown): PlanTodo[] {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { todos?: unknown }).todos)
      ? (raw as { todos: unknown[] }).todos
      : []
  return list
    .map((item, i) => {
      const t = item as RawTodo
      const label = String(t.content ?? t.label ?? "").trim()
      if (!label) return null
      const status = STATUSES.has(String(t.status))
        ? String(t.status)
        : "pending"
      return { id: String(t.id ?? i), label, status } as PlanTodo
    })
    .filter((t): t is PlanTodo => t !== null)
}

// Hermes todo_list: result is {todos:[{id,content,status}], revision}; the
// write call carries the same list in args.todos.
export function PlanTool({ toolData, className }: ToolBodyProps) {
  const args = toolData.input as Record<string, unknown> | undefined
  const result =
    toolData.state === "output-available"
      ? parseToolResult(toolData.output)
      : null
  const todos = toTodos(result ?? args?.todos)
  if (todos.length === 0) {
    return (
      <div className={className}>
        <div className="text-muted-foreground text-xs">No tasks</div>
      </div>
    )
  }
  return (
    <div className={className}>
      <Plan id={toolData.toolCallId} title="Tasks" todos={todos} />
    </div>
  )
}
