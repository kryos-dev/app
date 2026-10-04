"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import type { CronRun, DeliveryTarget } from "@/lib/cloud9/dashboard"
import {
  Binoculars,
  CalendarCheck,
  CaretDown,
  Clock,
  DotsThree,
  EnvelopeSimple,
  Lightbulb,
  MagnifyingGlass,
  Sun,
  UsersThree,
} from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type Job = {
  id: string
  name: string
  schedule_display: string
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  prompt?: string | null
  deliver?: string | null
}

type Form = { name: string; schedule: string; prompt: string; deliver: string }

const EMPTY: Form = { name: "", schedule: "", prompt: "", deliver: "local" }

type Template = {
  title: string
  description: string
  cron: string
  label: string
  prompt: string
  icon: typeof Sun
}

// The create dialog's schedule field round-trips whatever string is typed into it
// (see JobFields placeholder / app/api/cloud9/scheduled/route.ts, which forwards
// `schedule` verbatim) — cron expressions are sent as-is, no conversion needed.
const TEMPLATES: Template[] = [
  {
    title: "Daily briefing",
    description:
      "What needs your attention today across calendar, email, and messages.",
    cron: "0 8 * * 1-5",
    label: "Weekdays at 8:00 AM",
    prompt:
      "Give me a morning briefing: what needs my attention today across calendar, email and messages. Short, grouped by urgency.",
    icon: Sun,
  },
  {
    title: "Inbox triage",
    description: "Categorize your inbox and draft replies to anything urgent.",
    cron: "0 8 * * 1-5",
    label: "Weekdays at 8:00 AM",
    prompt:
      "Triage my inbox: categorize new emails and draft replies to anything urgent.",
    icon: EnvelopeSimple,
  },
  {
    title: "Meeting prep",
    description:
      "A short brief before each meeting on your calendar, covering attendees, context, and agenda.",
    cron: "0 8 * * 1-5",
    label: "Weekdays at 8:00 AM",
    prompt:
      "Prepare a short brief before each meeting on my calendar today: attendees, context, and agenda.",
    icon: UsersThree,
  },
  {
    title: "Weekly review",
    description: "A Friday summary of what happened this week.",
    cron: "0 16 * * 5",
    label: "Every Friday at 4:00 PM",
    prompt: "Give me a Friday summary of what happened this week.",
    icon: CalendarCheck,
  },
  {
    title: "Content ideas",
    description: "Fresh ideas for posts, drawn from what I worked on this week.",
    cron: "0 9 * * 1",
    label: "Every Monday at 9:00 AM",
    prompt:
      "Give me fresh content ideas for posts, drawn from what I worked on this week.",
    icon: Lightbulb,
  },
  {
    title: "Monitor a topic",
    description: "Watch the web for a topic and report only what changed.",
    cron: "0 9 * * *",
    label: "Every day at 9:00 AM",
    prompt: "Watch the web for [topic] and report only what changed.",
    icon: Binoculars,
  },
]

// Run history of one job: Hermes records each fire as a session, newest first.
function RunHistoryDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<{ runs: CronRun[] }>({
    queryKey: ["cloud9", "scheduled", job?.id, "runs"],
    enabled: !!job,
    queryFn: async () => {
      const res = await fetchClient(`/api/cloud9/scheduled/${job!.id}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not load runs")
      return body
    },
  })
  const runs = data?.runs ?? []
  const when = (t: CronRun["started_at"]) => {
    if (t == null) return "-"
    const d = new Date(typeof t === "number" && t < 1e12 ? t * 1000 : t)
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString()
  }

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run history: {job?.name}</DialogTitle>
        </DialogHeader>
        <StatusBlock
          isLoading={isLoading}
          error={error?.message}
          isEmpty={runs.length === 0}
          emptyLabel="No runs yet."
        >
          <div className="divide-border max-h-80 divide-y overflow-y-auto">
            {runs.map((run, i) => (
              <div key={run.id ?? i} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm">{run.title || run.id || "Run"}</span>
                <span className="text-muted-foreground shrink-0 text-13">
                  {run.is_active ? "Running" : when(run.started_at)}
                </span>
              </div>
            ))}
          </div>
        </StatusBlock>
      </DialogContent>
    </Dialog>
  )
}

type SortKey = "next" | "name" | "last"
const SORT_LABEL: Record<SortKey, string> = {
  next: "Next run",
  name: "Name",
  last: "Last run",
}

// date-fns isn't installed in this app; Intl.RelativeTimeFormat covers "in 12 min" fine.
function relativeTime(iso: string | null) {
  if (!iso) return "—"
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour")
  return rtf.format(Math.round(diffHr / 24), "day")
}

function statusBadge(job: Job) {
  if (!job.enabled) return <Badge variant="secondary">Paused</Badge>
  if (job.last_status && job.last_status !== "ok") {
    return <Badge variant="destructive">Failed</Badge>
  }
  return <Badge variant="outline">Active</Badge>
}

/** Shared by create and edit: the same fields either way. */
function JobFields({
  form,
  onChange,
  deliveryTargets,
  promptPlaceholder = "Prompt",
}: {
  form: Form
  onChange: (next: Form) => void
  deliveryTargets: DeliveryTarget[]
  promptPlaceholder?: string
}) {
  const options = deliveryTargets.length > 0 ? deliveryTargets : [{ id: "local", name: "Local (save only)" }]
  return (
    <div className="space-y-3">
      <Input
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <Input
        placeholder="Schedule (e.g. every 15m, or a cron expression)"
        value={form.schedule}
        onChange={(e) => onChange({ ...form, schedule: e.target.value })}
      />
      <Textarea
        placeholder={promptPlaceholder}
        className="min-h-24"
        value={form.prompt}
        onChange={(e) => onChange({ ...form, prompt: e.target.value })}
      />
      <Select value={form.deliver} onValueChange={(v) => onChange({ ...form, deliver: v })}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Deliver to" />
        </SelectTrigger>
        <SelectContent>
          {options.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ScheduledPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editing, setEditing] = useState<Job | null>(null)
  const [editForm, setEditForm] = useState<Form>(EMPTY)
  const [deleting, setDeleting] = useState<Job | null>(null)
  const [history, setHistory] = useState<Job | null>(null)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("next")

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["cloud9", "scheduled"] })

  const { data, isLoading, error } = useQuery<{ jobs: Job[]; deliveryTargets?: DeliveryTarget[] }>({
    queryKey: ["cloud9", "scheduled"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/scheduled")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to load jobs")
      return body
    },
  })

  const deliveryTargets = data?.deliveryTargets ?? []
  // "default ntfy if present else local".
  const defaultDeliver = deliveryTargets.some((t) => t.id === "ntfy") ? "ntfy" : "local"

  const jobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? data?.jobs ?? []
      : (data?.jobs ?? []).filter(
          (job) =>
            job.name.toLowerCase().includes(q) ||
            (job.prompt ?? "").toLowerCase().includes(q)
        )
    const sorted = [...filtered]
    if (sortKey === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortKey === "last") {
      sorted.sort(
        (a, b) =>
          new Date(b.last_run_at ?? 0).getTime() -
          new Date(a.last_run_at ?? 0).getTime()
      )
    } else {
      sorted.sort(
        (a, b) =>
          new Date(a.next_run_at ?? 0).getTime() -
          new Date(b.next_run_at ?? 0).getTime()
      )
    }
    return sorted
  }, [data?.jobs, search, sortKey])

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string
      action: "pause" | "resume" | "run"
    }) => {
      const res = await fetchClient(`/api/cloud9/scheduled/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Action failed")
      return body
    },
    onSuccess: refresh,
    onError: (err: Error) =>
      toast({
        title: "Job action failed",
        description: err.message,
        status: "error",
      }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/scheduled", {
        method: "POST",
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create job")
      return body
    },
    onSuccess: () => {
      toast({ title: "Job created" })
      refresh()
      setForm(EMPTY)
      setCreateOpen(false)
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      const res = await fetchClient(`/api/cloud9/scheduled/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to update job")
      return body
    },
    onSuccess: () => {
      toast({ title: "Job updated" })
      setEditing(null)
      refresh()
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchClient(`/api/cloud9/scheduled/${id}`, {
        method: "DELETE",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to delete job")
      return body
    },
    onSuccess: () => {
      toast({ title: "Job deleted" })
      setDeleting(null)
      refresh()
    },
    onError: (err: Error) => {
      setDeleting(null)
      toast({ title: "Failed", description: err.message, status: "error" })
    },
  })

  const openEdit = (job: Job) => {
    setEditForm({
      name: job.name,
      // schedule_display is what the API hands back; it round-trips as the
      // schedule expression for the natural-language forms ("every 15m") the
      // create dialog already accepts.
      schedule: job.schedule_display,
      prompt: job.prompt ?? "",
      deliver: job.deliver ?? defaultDeliver,
    })
    setEditing(job)
  }

  const openTemplate = (template: Template) => {
    setForm({ name: template.title, schedule: template.cron, prompt: template.prompt, deliver: defaultDeliver })
    setCreateOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled tasks</h1>
          <p className="text-muted-foreground text-sm">
            Run tasks on a schedule or whenever you need them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 pl-8 sm:w-56"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Sort by {SORT_LABEL[sortKey]}
                <CaretDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <DropdownMenuItem key={key} onSelect={() => setSortKey(key)}>
                  {SORT_LABEL[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                New task
                <CaretDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setForm({ ...EMPTY, deliver: defaultDeliver })
                  setCreateOpen(true)
                }}
              >
                Blank task
              </DropdownMenuItem>
              {TEMPLATES.map((template) => (
                <DropdownMenuItem
                  key={template.title}
                  onSelect={() => openTemplate(template)}
                >
                  {template.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <JobFields form={form} onChange={setForm} deliveryTargets={deliveryTargets} />
          <DialogFooter>
            <Button
              disabled={!form.name || !form.schedule || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <JobFields
            form={editForm}
            onChange={setEditForm}
            deliveryTargets={deliveryTargets}
            promptPlaceholder="Leave blank to keep the current prompt"
          />
          <DialogFooter>
            <Button
              disabled={
                !editForm.name || !editForm.schedule || updateMutation.isPending
              }
              onClick={() => updateMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The job stops running and its schedule is removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RunHistoryDialog job={history} onClose={() => setHistory(null)} />

      <StatusBlock isLoading={isLoading} error={error?.message}>
        {jobs.length === 0 ? (
          <div>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Clock className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">No scheduled tasks yet.</p>
            </div>
            <Separator className="h-px border-t border-dashed border-border bg-transparent" />
          </div>
        ) : (
          <div className="divide-border divide-y rounded-xl border border-border">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{job.name}</p>
                  <p className="text-muted-foreground truncate text-13">
                    {job.schedule_display} · next {relativeTime(job.next_run_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {statusBadge(job)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <DotsThree className="size-5" weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={actionMutation.isPending}
                        onSelect={() =>
                          actionMutation.mutate({ id: job.id, action: "run" })
                        }
                      >
                        Run now
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={actionMutation.isPending}
                        onSelect={() =>
                          actionMutation.mutate({
                            id: job.id,
                            action: job.enabled ? "pause" : "resume",
                          })
                        }
                      >
                        {job.enabled ? "Pause" : "Resume"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setHistory(job)}>
                        Run history
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(job)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(job)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </StatusBlock>

      <div className="mt-8">
        <h2 className="text-sm font-medium">Templates</h2>
        <p className="text-muted-foreground mb-3 text-13">
          Start from a common task instead of a blank one.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TEMPLATES.map((template) => {
            const Icon = template.icon
            return (
              <Card
                key={template.title}
                role="button"
                tabIndex={0}
                onClick={() => openTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openTemplate(template)
                }}
                className="hover:bg-accent cursor-pointer gap-2 py-4"
              >
                <CardContent className="flex flex-col gap-2 px-4">
                  <Icon className="size-5" />
                  <p className="text-sm font-medium">{template.title}</p>
                  <p className="text-muted-foreground text-13">
                    {template.description}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-1 text-13">
                    <Clock className="size-3.5" />
                    {template.label}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
