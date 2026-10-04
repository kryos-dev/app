import type { ReactNode } from "react"

// Shared title row: title left, primary action (or search input) right. Used by every cloud9 page.
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {action}
    </div>
  )
}
