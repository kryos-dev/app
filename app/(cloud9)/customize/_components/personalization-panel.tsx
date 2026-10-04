"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { SystemPromptSection } from "./system-prompt"

// Personalization: the user's own custom instructions, the agent persona
// (SOUL.md, editable) and the agent's memory (MEMORY.md / USER.md), which is
// read-only here because the agent writes it itself.

type MemoryEntry = { source: "memory" | "profile"; title: string; body: string }
type HermesData = { soul: string; entries: MemoryEntry[] }

const HERMES = "/api/cloud9/personalization/hermes"

// null = the caller is not an admin (403); agent-wide sections are hidden.
async function load<T>(url: string): Promise<T | null> {
  const res = await fetchClient(url)
  if (res.status === 403) return null
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Could not load")
  return body
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="secondary">Hermes</Badge>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
      {children}
    </section>
  )
}

function SoulEditor({ soul }: { soul: string }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetchClient(HERMES, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soul: content }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Save failed")
    },
    onSuccess: () => {
      toast({ title: "Persona saved", status: "success" })
      setDraft(null)
      void queryClient.invalidateQueries({ queryKey: [HERMES] })
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })
  const value = draft ?? soul
  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-40 font-mono text-sm"
        value={value}
        placeholder="Empty: Hermes uses its built-in identity."
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={value === soul || save.isPending}
          onClick={() => save.mutate(value)}
        >
          {save.isPending ? "Saving…" : "Save persona"}
        </Button>
      </div>
    </div>
  )
}

function Entries({ entries, empty }: { entries: MemoryEntry[]; empty: string }) {
  if (!entries.length) return <p className="text-muted-foreground text-sm">{empty}</p>
  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <p
          key={`${e.source}-${i}`}
          className="border-border rounded-md border p-3 text-sm whitespace-pre-wrap"
        >
          {e.body}
        </p>
      ))}
    </div>
  )
}

function HermesSections() {
  const { data, isLoading, error } = useQuery({
    queryKey: [HERMES],
    queryFn: () => load<HermesData>(HERMES),
  })

  if (data === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Persona and memory are shared by everyone on this agent; only admins can view or change
        them.
      </p>
    )
  }

  return (
    <StatusBlock isLoading={isLoading} error={error?.message}>
      {data && (
        <div className="space-y-8">
          <Section
            title="Persona"
            description="SOUL.md: who Hermes is and how it speaks. It is the first thing in its system prompt, in every chat and channel."
          >
            <SoulEditor soul={data.soul} />
          </Section>
          <Separator />
          <Section
            title="About you"
            description="USER.md: what Hermes has learned about you. The agent writes this itself; ask it in chat to change or forget something."
          >
            <Entries
              entries={data.entries.filter((e) => e.source === "profile")}
              empty="Nothing saved about you yet."
            />
          </Section>
          <Separator />
          <Section
            title="Memory"
            description="MEMORY.md: notes Hermes keeps across chats about your environment and past work. The agent writes this itself."
          >
            <Entries
              entries={data.entries.filter((e) => e.source === "memory")}
              empty="No saved memories."
            />
          </Section>
        </div>
      )}
    </StatusBlock>
  )
}

export function PersonalizationPanel() {
  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Custom instructions</h2>
          <Badge variant="secondary">Hermes</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Yours only. Added to the system prompt of every new chat; a project&apos;s instructions
          come first.
        </p>
        <SystemPromptSection />
      </section>
      <Separator />
      <HermesSections />
    </div>
  )
}
