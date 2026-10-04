"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import type { DashboardSkill } from "@/lib/cloud9/dashboard"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

const NEW_SKILL_TEMPLATE = `---
name: my-skill
description: One line. This is what the agent reads when deciding to use it.
---

# My skill

What the agent should do, in the order it should do it.
`

// The editor. A skill IS its SKILL.md, so the useful thing this can do is
// show that file and let it be changed.
export function SkillSheet({
  skill,
  onClose,
}: {
  skill: DashboardSkill | null
  onClose: () => void
}) {
  const [content, setContent] = useState("")
  const [dirty, setDirty] = useState(false)

  const { data, isLoading, error } = useQuery<{ content: string; path: string }>({
    queryKey: ["cloud9", "skills", "content", skill?.name],
    enabled: !!skill,
    queryFn: async () => {
      const res = await fetchClient(
        `/api/cloud9/skills/content?name=${encodeURIComponent(skill!.name)}`
      )
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Failed to load")
      }
      return res.json()
    },
  })

  useEffect(() => {
    setContent(data?.content ?? "")
    setDirty(false)
  }, [data?.content, skill?.name])

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/skills/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: skill!.name, content }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Save failed")
    },
    onSuccess: () => {
      setDirty(false)
      toast({ title: `${skill?.name} saved`, status: "success" })
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  return (
    <Sheet open={!!skill} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{skill?.name}</SheetTitle>
          <SheetDescription className="break-all">
            {skill?.provenance === "bundled"
              ? "Built into Hermes — an upgrade overwrites edits made here."
              : data?.path}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4">
          <StatusBlock isLoading={isLoading} error={error?.message}>
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setDirty(true)
              }}
              spellCheck={false}
              className="h-[60vh] font-mono text-13"
            />
          </StatusBlock>
        </div>

        <SheetFooter>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function NewSkillDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [content, setContent] = useState(NEW_SKILL_TEMPLATE)

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, category }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Create failed")
    },
    onSuccess: () => {
      toast({ title: `${name} created`, status: "success" })
      onCreated()
      onOpenChange(false)
      setName("")
      setCategory("")
      setContent(NEW_SKILL_TEMPLATE)
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-9/10 overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New skill</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. cloud9-invoices"
            aria-label="Skill name"
          />
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional)"
            aria-label="Category"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="h-72 font-mono text-13"
            aria-label="SKILL.md"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !content.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// "Install from URL/identifier" on the Add menu -- the hub install endpoint
// takes one string (a hub identifier or a raw URL) and installs in the
// background, same as clicking Install in Discover.
export function InstallSkillDialog({
  open,
  onOpenChange,
  onInstalled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInstalled: () => void
}) {
  const [identifier, setIdentifier] = useState("")

  const install = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/skills/hub/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Install failed")
    },
    onSuccess: () => {
      toast({ title: "Install started", status: "success" })
      onInstalled()
      onOpenChange(false)
      setIdentifier("")
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Install from URL or identifier</DialogTitle>
        </DialogHeader>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="github.com/org/skill or a hub identifier"
          aria-label="Skill URL or identifier"
        />
        <DialogFooter>
          <Button
            onClick={() => install.mutate()}
            disabled={!identifier.trim() || install.isPending}
          >
            {install.isPending ? "Installing…" : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
