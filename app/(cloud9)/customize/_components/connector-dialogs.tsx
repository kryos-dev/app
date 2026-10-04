"use client"

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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import type { CatalogEntry } from "@/lib/cloud9/dashboard"
import { fetchClient } from "@/lib/fetch"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

// Two kinds of MCP server, and the difference is which field you fill in: a
// URL for a remote one, a command for one Hermes launches itself.
export function AddServerDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [command, setCommand] = useState("")
  const [args, setArgs] = useState("")

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url: url || undefined,
          command: command || undefined,
          args: args.trim() ? args.trim().split(/\s+/) : [],
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Could not add the server")
    },
    onSuccess: () => {
      toast({ title: `${name} added`, status: "success" })
      onAdded()
      onOpenChange(false)
      setName("")
      setUrl("")
      setCommand("")
      setArgs("")
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an MCP server</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Server name"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL, for a remote server"
            aria-label="Server URL"
            disabled={!!command}
          />
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Command, for a server Hermes launches"
            aria-label="Command"
            disabled={!!url}
          />
          <Input
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="Arguments, space separated"
            aria-label="Arguments"
            disabled={!command}
          />
          <p className="text-muted-foreground text-13">
            API keys go in the agent&apos;s .env, not here.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={() => add.mutate()}
            disabled={!name.trim() || (!url.trim() && !command.trim()) || add.isPending}
          >
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveServerAlert({
  name,
  onOpenChange,
  onConfirm,
}: {
  name: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}) {
  return (
    <AlertDialog open={!!name} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It comes out of the agent&apos;s config. Any credentials it used stay in the
            .env file.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => name && onConfirm(name)}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Catalog entries declare the environment variables they need (API keys);
// Hermes stores them in its own .env, so they are only typed here once.
export function CatalogEnvDialog({
  entry,
  onOpenChange,
  onConfirm,
  pending,
}: {
  entry: CatalogEntry | null
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string, env: Record<string, string>) => void
  pending: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const fields = entry?.required_env ?? []
  const missing = fields.some((f) => f.required !== false && !values[f.name]?.trim())

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Install {entry?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <Input
              key={f.name}
              type="password"
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              placeholder={f.prompt || f.name}
              aria-label={f.name}
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={missing || pending}
            onClick={() => entry && onConfirm(entry.name, values)}
          >
            {pending ? "Installing…" : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
