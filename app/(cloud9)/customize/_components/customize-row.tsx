import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { DotsThree } from "@phosphor-icons/react"
import type { ReactNode } from "react"

// One row shape for every list in Customize (skills, connectors, catalog
// results) -- icon box, name + optional badge, one truncated subtitle line,
// a right-side status/date, and a ⋮ menu for row actions. Built once so a
// layout tweak only happens here.
export function CustomizeRow({
  icon,
  name,
  badge,
  subtitle,
  right,
  menu,
  onClick,
}: {
  icon: ReactNode
  name: string
  badge?: { label: string; variant?: "default" | "secondary" | "outline" | "destructive" }
  subtitle?: string
  right?: ReactNode
  menu?: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className={
        onClick
          ? "hover:bg-accent/50 flex cursor-pointer items-center gap-3 px-4 py-3"
          : "flex items-center gap-3 px-4 py-3"
      }
      onClick={onClick}
    >
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {badge && (
            <Badge variant={badge.variant ?? "secondary"} className="shrink-0">
              {badge.label}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-muted-foreground truncate text-13">{subtitle}</p>
        )}
      </div>
      {right && <span className="text-muted-foreground shrink-0 text-13">{right}</span>}
      {menu && (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                aria-label={`Actions for ${name}`}
              >
                <DotsThree size={18} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

export function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-2 text-sm font-medium">
      {title} <span className="text-muted-foreground">· {count}</span>
    </h2>
  )
}

export function CustomizeEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed">
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

// Loading state for a row list: the rows that are coming, greyed. A spinner
// here would move the layout twice (spinner, then rows); this settles once.
export function CustomizeLoading({ rows = 4 }: { rows?: number }) {
  return (
    <RowGroup>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </RowGroup>
  )
}

export function RowGroup({ children }: { children: ReactNode }) {
  return <div className="divide-border divide-y rounded-xl border">{children}</div>
}
