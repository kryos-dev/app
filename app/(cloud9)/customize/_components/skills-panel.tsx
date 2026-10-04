"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import type { DashboardSkill, HubSkill } from "@/lib/cloud9/dashboard"
import { fetchClient } from "@/lib/fetch"
import { CaretDown, Check, Plus, Sparkle } from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import {
  CustomizeEmpty,
  CustomizeLoading,
  CustomizeRow,
  GroupHeader,
  RowGroup,
} from "./customize-row"
import { InstallSkillDialog, NewSkillDialog, SkillSheet } from "./skill-dialogs"
import { SearchBox, SortMenu } from "./toolbar"

const KEY = ["cloud9", "skills"]

// Where a skill came from, worst-to-best in terms of "is it safe to edit".
const GROUPS: { key: DashboardSkill["provenance"]; title: string }[] = [
  { key: "agent", title: "Created by you" },
  { key: "hub", title: "Installed" },
  { key: "bundled", title: "Built into Hermes" },
]

export function SkillsPanel({
  view,
  onViewChange,
}: {
  view: "yours" | "discover"
  onViewChange: (view: "yours" | "discover") => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("name")
  const [provenanceFilter, setProvenanceFilter] = useState<"all" | "agent">("all")
  const [openSkill, setOpenSkill] = useState<DashboardSkill | null>(null)
  const [creating, setCreating] = useState(false)
  const [installing, setInstalling] = useState(false)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as "yours" | "discover")}>
          <TabsList>
            <TabsTrigger value="yours">Yours</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "yours" && (
          <Tabs
            value={provenanceFilter}
            onValueChange={(v) => setProvenanceFilter(v as "all" | "agent")}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="agent">Agent-written</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={view === "yours" ? "Search your skills…" : "Search the skills hub…"}
        />
        <SortMenu value={sort} onChange={setSort} options={[{ value: "name", label: "Name" }]} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="shrink-0">
              Add
              <CaretDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setCreating(true)}>Create skill</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setInstalling(true)}>
              Install from URL/identifier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {view === "yours" ? (
        <YoursSkills search={search} provenanceFilter={provenanceFilter} onOpen={setOpenSkill} />
      ) : (
        <DiscoverSkills search={search} />
      )}

      <SkillSheet skill={openSkill} onClose={() => setOpenSkill(null)} />
      <NewSkillDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => queryClient.invalidateQueries({ queryKey: KEY })}
      />
      <InstallSkillDialog
        open={installing}
        onOpenChange={setInstalling}
        onInstalled={() => queryClient.invalidateQueries({ queryKey: KEY })}
      />
    </div>
  )
}

function YoursSkills({
  search,
  provenanceFilter,
  onOpen,
}: {
  search: string
  provenanceFilter: "all" | "agent"
  onOpen: (skill: DashboardSkill) => void
}) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<{ skills: DashboardSkill[] }>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/skills")
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => null))?.error || "Failed to load skills"
        )
      }
      return res.json()
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      const res = await fetchClient("/api/cloud9/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      })
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Toggle failed")
      }
    },
    // Optimistic: the round trip goes through the dashboard API and a config
    // write, which is slow enough that a switch waiting for it feels broken.
    onMutate: async ({ name, enabled }) => {
      await queryClient.cancelQueries({ queryKey: KEY })
      const previous = queryClient.getQueryData<{ skills: DashboardSkill[] }>(KEY)
      queryClient.setQueryData<{ skills: DashboardSkill[] }>(KEY, (old) =>
        old
          ? { skills: old.skills.map((s) => (s.name === name ? { ...s, enabled } : s)) }
          : old
      )
      return { previous }
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous)
      toast({ title: e.message, status: "error" })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = (data?.skills ?? []).filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    )
    return GROUPS.filter((group) => provenanceFilter === "all" || group.key === "agent")
      .map((group) => ({
        ...group,
        // Anything Hermes did not classify is treated as ours, which is the
        // group that can be edited -- better than hiding it in an "Other" bucket.
        skills: filtered
          .filter((s) =>
            group.key === "agent" ? !s.provenance || s.provenance === "agent" : s.provenance === group.key
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.skills.length > 0)
  }, [data, search, provenanceFilter])

  if (isLoading) return <CustomizeLoading />
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )
  if (groups.length === 0)
    return <CustomizeEmpty label={search ? "No skill matches that." : "No skills found."} />

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <GroupHeader title={group.title} count={group.skills.length} />
          <RowGroup>
            {group.skills.map((skill) => (
              <CustomizeRow
                key={skill.name}
                icon={<Sparkle className="text-muted-foreground" />}
                name={skill.name}
                badge={skill.enabled === false ? { label: "Disabled", variant: "outline" } : undefined}
                subtitle={skill.description}
                right={!!skill.usage && `${skill.usage}×`}
                onClick={() => onOpen(skill)}
                menu={
                  <>
                    <DropdownMenuItem onSelect={() => onOpen(skill)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => toggle.mutate({ name: skill.name, enabled: !(skill.enabled ?? true) })}
                    >
                      {(skill.enabled ?? true) ? "Disable" : "Enable"}
                    </DropdownMenuItem>
                  </>
                }
              />
            ))}
          </RowGroup>
        </div>
      ))}
    </div>
  )
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function DiscoverSkills({ search }: { search: string }) {
  const queryClient = useQueryClient()
  const q = useDebounced(search.trim(), 300)

  const official = useQuery<{ skills: HubSkill[] }>({
    queryKey: ["cloud9", "skills", "hub", "official"],
    enabled: q.length === 0,
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/skills/hub/official")
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load")
      return res.json()
    },
  })

  const results = useQuery<{ skills: HubSkill[] }>({
    queryKey: ["cloud9", "skills", "hub", "search", q],
    enabled: q.length > 0,
    queryFn: async () => {
      const res = await fetchClient(`/api/cloud9/skills/hub/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Search failed")
      return res.json()
    },
  })

  const install = useMutation({
    mutationFn: async (identifier: string) => {
      const res = await fetchClient("/api/cloud9/skills/hub/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Install failed")
    },
    onSuccess: (_data, identifier) => {
      toast({ title: `Installing ${identifier}…`, status: "success" })
      queryClient.invalidateQueries({ queryKey: KEY })
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  const active = q.length > 0 ? results : official
  const groupTitle = q.length > 0 ? "Results" : "Official (Nous)"

  if (active.isLoading) return <CustomizeLoading />
  if (active.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{(active.error as Error).message}</AlertDescription>
      </Alert>
    )

  const skills = active.data?.skills ?? []
  if (skills.length === 0) return <CustomizeEmpty label="No skills found." />

  return (
    <div>
      <GroupHeader title={groupTitle} count={skills.length} />
      <RowGroup>
        {skills.map((skill) => (
          <CustomizeRow
            key={skill.identifier ?? skill.name}
            icon={<Sparkle className="text-muted-foreground" />}
            name={skill.name}
            badge={skill.source ? { label: skill.source, variant: "outline" } : undefined}
            subtitle={skill.description}
            right={
              skill.installed ? (
                <span className="flex items-center gap-1">
                  <Check /> Installed
                </span>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Install ${skill.name}`}
                  disabled={install.isPending}
                  onClick={() => install.mutate(skill.identifier ?? skill.name)}
                >
                  <Plus />
                </Button>
              )
            }
          />
        ))}
      </RowGroup>
    </div>
  )
}
