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
import type { CatalogEntry, McpServer, Toolset } from "@/lib/cloud9/dashboard"
import { fetchClient } from "@/lib/fetch"
import { CaretDown, Check, Plug, Plus, Wrench } from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  CustomizeEmpty,
  CustomizeLoading,
  CustomizeRow,
  GroupHeader,
  RowGroup,
} from "./customize-row"
import { AddServerDialog, CatalogEnvDialog, RemoveServerAlert } from "./connector-dialogs"
import { SearchBox, SortMenu } from "./toolbar"

type ConnectorsResponse = {
  mcp: { servers?: McpServer[]; error?: string; configured?: boolean }
  toolsets: Toolset[]
  toolsetsError: string | null
}

const KEY = ["cloud9", "connectors"]

function titleCase(name: string) {
  return name
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ConnectorsPanel({
  view,
  onViewChange,
}: {
  view: "yours" | "discover"
  onViewChange: (view: "yours" | "discover") => void
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("name")
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as "yours" | "discover")}>
          <TabsList>
            <TabsTrigger value="yours">Yours</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={view === "yours" ? "Search your connectors…" : "Search the catalog…"}
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
            <DropdownMenuItem onSelect={() => setAdding(true)}>Add MCP server</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewChange("discover")}>
              Browse catalog
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {view === "yours" ? (
        <YoursConnectors search={search} />
      ) : (
        <DiscoverConnectors search={search} />
      )}

      <AddServerDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => {
          /* invalidated inside YoursConnectors' own query on remount via KEY */
        }}
      />
    </div>
  )
}

function YoursConnectors({ search }: { search: string }) {
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<ConnectorsResponse>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/connectors")
      if (!res.ok) throw new Error("Failed to load connectors")
      return res.json()
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY })

  const toggle = useMutation({
    mutationFn: async (body: { name?: string; toolset?: string; enabled: boolean }) => {
      const res = await fetchClient("/api/cloud9/connectors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Toggle failed")
      }
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
    onSettled: invalidate,
  })

  // OAuth login. Hermes returns a URL to visit; the provider redirects to the
  // Hermes dashboard's own callback, so all this side does is open the tab and
  // watch the flow until it is no longer pending.
  const login = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchClient("/api/cloud9/connectors/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const flow = await res.json().catch(() => null)
      if (!res.ok) throw new Error(flow?.error || "Could not start login")
      if (!flow?.authorization_url) {
        throw new Error(flow?.error || "Hermes returned no authorization URL")
      }
      window.open(flow.authorization_url, "_blank", "noopener,noreferrer")

      // Poll rather than wait on the popup: the tab that finishes the login is
      // the dashboard's, not ours, and it never talks back to this one.
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const poll = await fetchClient(
          `/api/cloud9/connectors/auth?flow=${encodeURIComponent(flow.flow_id)}`
        )
        const state = await poll.json().catch(() => null)
        if (!poll.ok) continue
        if (state?.status === "approved" || state?.status === "error") {
          if (state.error) throw new Error(state.error)
          return state
        }
      }
      throw new Error("Login timed out — try again")
    },
    onSuccess: (_state, name) => {
      toast({ title: `${name}: signed in`, status: "success" })
      invalidate()
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  const test = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchClient("/api/cloud9/connectors/test", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Test failed")
      return body
    },
    onSuccess: (_body, name) => toast({ title: `${name}: ok`, status: "success" }),
    onError: (err: Error) => toast({ title: err.message, status: "error" }),
  })

  const remove = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchClient(`/api/cloud9/connectors?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Remove failed")
      }
    },
    onSuccess: () => toast({ title: "Connector removed", status: "success" }),
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
    onSettled: () => {
      setRemoving(null)
      invalidate()
    },
  })

  if (isLoading) return <CustomizeLoading />

  const q = search.trim().toLowerCase()
  const servers = (data?.mcp.servers ?? [])
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  const toolsets = (data?.toolsets ?? [])
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  const nothingLoaded = error && servers.length === 0 && toolsets.length === 0

  return (
    <div className="space-y-6">
      {(error || data?.mcp.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {error ? (error as Error).message : data?.mcp.error}
            {data?.mcp.configured === false &&
              " Check HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD."}
          </AlertDescription>
        </Alert>
      )}
      {data?.toolsetsError && (
        <Alert variant="destructive">
          <AlertDescription>{data.toolsetsError}</AlertDescription>
        </Alert>
      )}

      {!nothingLoaded && servers.length > 0 && (
        <div>
          <GroupHeader title="Installed" count={servers.length} />
          <RowGroup>
            {servers.map((server) => (
              <CustomizeRow
                key={server.name}
                icon={<Plug className="text-muted-foreground" />}
                name={server.name}
                badge={!server.enabled ? { label: "Disabled", variant: "outline" } : undefined}
                subtitle={`${server.transport}${server.auth ? ` · ${server.auth}` : ""}`}
                menu={
                  <>
                    <DropdownMenuItem
                      disabled={login.isPending}
                      onSelect={() => login.mutate(server.name)}
                    >
                      Log in
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => test.mutate(server.name)}>
                      Test
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => toggle.mutate({ name: server.name, enabled: !server.enabled })}
                    >
                      {server.enabled ? "Disable" : "Enable"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setRemoving(server.name)}
                    >
                      Remove
                    </DropdownMenuItem>
                  </>
                }
              />
            ))}
          </RowGroup>
        </div>
      )}

      {toolsets.length > 0 && (
        <div>
          <GroupHeader title="Built into Hermes" count={toolsets.length} />
          <RowGroup>
            {toolsets.map((toolset) => (
              <CustomizeRow
                key={toolset.name}
                icon={<Wrench className="text-muted-foreground" />}
                name={titleCase(toolset.name)}
                badge={!toolset.enabled ? { label: "Disabled", variant: "outline" } : undefined}
                subtitle={toolset.tools.join(", ")}
                menu={
                  <DropdownMenuItem
                    onSelect={() => toggle.mutate({ toolset: toolset.name, enabled: !toolset.enabled })}
                  >
                    {toolset.enabled ? "Disable" : "Enable"}
                  </DropdownMenuItem>
                }
              />
            ))}
          </RowGroup>
        </div>
      )}

      {!nothingLoaded && servers.length === 0 && toolsets.length === 0 && (
        <CustomizeEmpty label={search ? "No connector matches that." : "No connectors found."} />
      )}

      <RemoveServerAlert
        name={removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        onConfirm={(name) => remove.mutate(name)}
      />
    </div>
  )
}

function DiscoverConnectors({ search }: { search: string }) {
  const queryClient = useQueryClient()
  const [configuring, setConfiguring] = useState<CatalogEntry | null>(null)

  const { data, isLoading, error } = useQuery<{ catalog: CatalogEntry[] }>({
    queryKey: ["cloud9", "connectors", "catalog"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/connectors/catalog")
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load")
      return res.json()
    },
  })

  const install = useMutation({
    mutationFn: async ({ name, env }: { name: string; env?: Record<string, string> }) => {
      const res = await fetchClient("/api/cloud9/connectors/catalog/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, env }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Install failed")
    },
    onSuccess: (_data, { name }) => {
      setConfiguring(null)
      toast({ title: `${name} installed`, status: "success" })
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ["cloud9", "connectors", "catalog"] })
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  })

  if (isLoading) return <CustomizeLoading />
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )

  const q = search.trim().toLowerCase()
  const entries = (data?.catalog ?? []).filter(
    (e) => !q || (typeof e.name === "string" && e.name.toLowerCase().includes(q))
  )

  if (entries.length === 0) return <CustomizeEmpty label="No catalog entries found." />

  return (
    <div>
      <GroupHeader title="Catalog" count={entries.length} />
      <RowGroup>
        {entries.map((entry) => (
          <CustomizeRow
            key={entry.name}
            icon={<Plug className="text-muted-foreground" />}
            name={entry.name}
            subtitle={typeof entry.description === "string" ? entry.description : undefined}
            right={
              entry.installed ? (
                <span className="flex items-center gap-1">
                  <Check /> Installed
                </span>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Install ${entry.name}`}
                  disabled={install.isPending}
                  onClick={() =>
                    entry.required_env?.length
                      ? setConfiguring(entry)
                      : install.mutate({ name: entry.name })
                  }
                >
                  <Plus />
                </Button>
              )
            }
          />
        ))}
      </RowGroup>
      <CatalogEnvDialog
        key={configuring?.name}
        entry={configuring}
        pending={install.isPending}
        onOpenChange={(open) => !open && setConfiguring(null)}
        onConfirm={(name, env) => install.mutate({ name, env })}
      />
    </div>
  )
}
