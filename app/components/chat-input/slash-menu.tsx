import { cn } from "@/lib/utils"
import type { SlashCommand } from "./slash-commands"

/**
 * The menu that appears above the composer while a slash command is being
 * typed.
 *
 * Rendered as a plain list rather than a popover on purpose: it must sit above
 * the composer on a phone, where a floating popover fights the on-screen
 * keyboard and frequently loses. Every row is a full-width tap target, because
 * arrow keys are a desktop luxury and this app is used on a phone.
 */
export function SlashMenu({
  commands,
  activeIndex,
  onSelect,
  onHover,
}: {
  commands: SlashCommand[]
  activeIndex: number
  onSelect: (command: SlashCommand) => void
  onHover: (index: number) => void
}) {
  if (commands.length === 0) return null

  return (
    <div className="border-border bg-popover absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border shadow-md">
      <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
        {commands.map((command, index) => (
          <li key={command.name}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              // onMouseDown, not onClick: the textarea is focused, and a click
              // would blur it first and close the menu before this ever fires.
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(command)
              }}
              onMouseEnter={() => onHover(index)}
              className={cn(
                "flex w-full items-baseline gap-3 px-4 py-2.5 text-left text-sm",
                index === activeIndex ? "bg-accent" : "bg-transparent"
              )}
            >
              <span className="font-medium">/{command.name}</span>
              <span className="text-muted-foreground truncate text-13">
                {command.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
