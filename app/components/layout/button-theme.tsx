"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

// system -> light -> dark -> system. One button, not a menu: three states cycle
// faster than they pick, and the icon already says which one you are on.
const ORDER = ["system", "light", "dark"] as const
const ICON = { system: DesktopIcon, light: SunIcon, dark: MoonIcon }
const LABEL = { system: "Theme: auto", light: "Theme: light", dark: "Theme: dark" }

export function ButtonTheme() {
  const { theme, setTheme } = useTheme()
  // next-themes knows nothing until it has read localStorage, so the server
  // render and the first client render must not disagree about the icon.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const current = (mounted && theme) || "system"
  const key = (ORDER.includes(current as never) ? current : "system") as keyof typeof ICON
  const Icon = ICON[key]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(ORDER[(ORDER.indexOf(key) + 1) % ORDER.length])}
          className="pointer-events-auto rounded-lg"
        >
          <Icon className="size-5" />
          <span className="sr-only">{LABEL[key]}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL[key]}</TooltipContent>
    </Tooltip>
  )
}
