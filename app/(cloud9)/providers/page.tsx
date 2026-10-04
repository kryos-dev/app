"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/lib/user-store/provider"
import { fetchClient } from "@/lib/fetch"
import { useCallback, useEffect, useRef, useState } from "react"

type EnvRow = { key: string; isSet: boolean; preview: string | null }
type OAuthProvider = {
  id: string
  name: string
  disconnectable: boolean
  status: { logged_in?: boolean }
}
type Flow = { sessionId: string; userCode: string; url: string; interval: number }

type CardDef = {
  title: string
  hint?: string
  fields: { key: string; label: string; secret?: boolean }[]
  // Extra env keys that receive the first field's value.
  alsoSave?: string[]
}

const CARDS: CardDef[] = [
  {
    title: "OpenCode Go",
    fields: [{ key: "OPENCODE_GO_API_KEY", label: "API key", secret: true }],
    alsoSave: ["OPENCODE_API_KEY"],
  },
  { title: "DeepSeek", fields: [{ key: "DEEPSEEK_API_KEY", label: "API key", secret: true }] },
  {
    title: "Brave Search",
    fields: [{ key: "BRAVE_SEARCH_API_KEY", label: "API key", secret: true }],
  },
  { title: "Exa", fields: [{ key: "EXA_API_KEY", label: "API key", secret: true }] },
  {
    title: "Firecrawl",
    hint: "Set the URL for a self-hosted instance; the key is optional.",
    fields: [
      { key: "FIRECRAWL_API_URL", label: "API URL" },
      { key: "FIRECRAWL_API_KEY", label: "API key (optional)", secret: true },
    ],
  },
  {
    title: "Claude subscription",
    hint: "Run `claude setup-token` locally and paste the token here.",
    fields: [{ key: "CLAUDE_CODE_OAUTH_TOKEN", label: "OAuth token", secret: true }],
  },
]

const errMsg = async (res: Response) =>
  ((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText

const fail = (title: string, description: string) =>
  toast({ title, description, status: "error" })

export default function ProvidersPage() {
  const { user } = useUser()
  const [env, setEnv] = useState<EnvRow[]>([])
  const [oauth, setOauth] = useState<OAuthProvider[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetchClient("/api/cloud9/providers")
    if (!res.ok) return setError(await errMsg(res))
    const data = (await res.json()) as { env: EnvRow[]; oauth: OAuthProvider[] }
    setError(null)
    setEnv(data.env)
    setOauth(data.oauth)
  }, [])

  useEffect(() => {
    if (user?.is_admin) void load()
  }, [user?.is_admin, load])

  if (user && !user.is_admin) {
    return <p className="text-muted-foreground text-sm">Admins only.</p>
  }

  const isSet = (key: string) => env.find((r) => r.key === key)?.isSet ?? false

  return (
    <>
      <PageHeader title="Providers" action={<RestartButton />} />
      {error && <p className="text-destructive mb-4 text-sm">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((c) => (
          <KeyCard key={c.title} card={c} isSet={isSet} onSaved={load} />
        ))}
        <ChatGptCard provider={oauth.find((p) => p.id === "openai-codex")} onChange={load} />
      </div>
      <h2 className="mt-8 mb-3 text-base font-semibold">Environment keys</h2>
      <EnvTable rows={env} onChange={load} />
    </>
  )
}

function KeyCard({
  card,
  isSet,
  onSaved,
}: {
  card: CardDef
  isSet: (key: string) => boolean
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function save() {
    const entries: Record<string, string> = {}
    for (const f of card.fields) if (values[f.key]) entries[f.key] = values[f.key]
    const first = values[card.fields[0].key]
    if (first) for (const k of card.alsoSave ?? []) entries[k] = first
    if (!Object.keys(entries).length) return
    setBusy(true)
    const res = await fetchClient("/api/cloud9/providers", {
      method: "PUT",
      body: JSON.stringify({ entries }),
    })
    setBusy(false)
    if (!res.ok) return fail("Save failed", await errMsg(res))
    setValues({})
    toast({ title: `${card.title} saved` })
    onSaved()
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{card.title}</h3>
          <Badge variant={isSet(card.fields[0].key) ? "outline" : "secondary"}>
            {isSet(card.fields[0].key) ? "Configured" : "Not set"}
          </Badge>
        </div>
        {card.hint && <p className="text-muted-foreground text-xs">{card.hint}</p>}
        {card.fields.map((f) => (
          <Input
            key={f.key}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={f.label}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
        ))}
        <Button size="sm" onClick={save} disabled={busy}>
          Save
        </Button>
      </CardContent>
    </Card>
  )
}

function ChatGptCard({
  provider,
  onChange,
}: {
  provider?: OAuthProvider
  onChange: () => void
}) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const base = "/api/cloud9/providers/oauth/openai-codex"

  useEffect(() => () => clearTimeout(timer.current), [])

  function poll(f: Flow) {
    timer.current = setTimeout(async () => {
      const res = await fetchClient(`${base}?session=${encodeURIComponent(f.sessionId)}`)
      if (!res.ok) {
        setFlow(null)
        return fail("Sign-in failed", await errMsg(res))
      }
      const { status, error_message } = (await res.json()) as {
        status: string
        error_message?: string
      }
      if (status === "pending") return poll(f)
      setFlow(null)
      if (status === "approved") toast({ title: "ChatGPT connected" })
      else fail("Sign-in did not finish", error_message ?? status)
      onChange()
    }, f.interval * 1000)
  }

  async function start() {
    const res = await fetchClient(base, { method: "POST" })
    if (!res.ok) return fail("Could not start sign-in", await errMsg(res))
    const d = (await res.json()) as {
      session_id: string
      user_code: string
      verification_url: string
      poll_interval: number
    }
    const f = {
      sessionId: d.session_id,
      userCode: d.user_code,
      url: d.verification_url,
      interval: Math.max(d.poll_interval || 5, 2),
    }
    setFlow(f)
    poll(f)
  }

  async function disconnect() {
    const res = await fetchClient(base, { method: "DELETE" })
    if (!res.ok) return fail("Disconnect failed", await errMsg(res))
    onChange()
  }

  const connected = provider?.status.logged_in

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">ChatGPT subscription</h3>
          <Badge variant={connected ? "outline" : "secondary"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        {flow ? (
          <div className="space-y-1 text-sm">
            <p>
              Open{" "}
              <a className="underline" href={flow.url} target="_blank" rel="noreferrer">
                {flow.url}
              </a>{" "}
              and enter this code:
            </p>
            <p className="font-mono text-lg tracking-widest">{flow.userCode}</p>
            <p className="text-muted-foreground text-xs">Waiting for approval...</p>
          </div>
        ) : connected ? (
          <Button
            size="sm"
            variant="outline"
            onClick={disconnect}
            disabled={provider?.disconnectable === false}
          >
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={!provider}>
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function EnvTable({ rows, onChange }: { rows: EnvRow[]; onChange: () => void }) {
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")

  async function set() {
    if (!key.trim() || !value) return
    const res = await fetchClient("/api/cloud9/providers", {
      method: "PUT",
      body: JSON.stringify({ entries: { [key.trim()]: value } }),
    })
    if (!res.ok) return fail("Save failed", await errMsg(res))
    setKey("")
    setValue("")
    onChange()
  }

  async function remove(k: string) {
    const res = await fetchClient("/api/cloud9/providers", {
      method: "DELETE",
      body: JSON.stringify({ key: k }),
    })
    if (!res.ok) return fail("Delete failed", await errMsg(res))
    onChange()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="KEY" value={key} onChange={(e) => setKey(e.target.value)} />
        <Input
          type="password"
          autoComplete="off"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button size="sm" onClick={set}>
          Set
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows
            .filter((r) => r.isSet)
            .map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-mono text-xs">{r.key}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {r.preview}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(r.key)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RestartButton() {
  const [busy, setBusy] = useState(false)

  async function restart() {
    setBusy(true)
    const res = await fetchClient("/api/cloud9/providers/restart", { method: "POST" })
    if (!res.ok) {
      setBusy(false)
      return fail("Restart failed", await errMsg(res))
    }
    // Give the gateway a moment to go down before waiting for it to return.
    await new Promise((r) => setTimeout(r, 3000))
    for (let i = 0; i < 40; i++) {
      const h = await fetchClient("/api/cloud9/providers/restart")
      if (h.ok && ((await h.json()) as { up: boolean }).up) {
        setBusy(false)
        return toast({ title: "Gateway is back" })
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    setBusy(false)
    fail("Gateway did not come back", "Health check timed out after about 80 seconds.")
  }

  return (
    <Button size="sm" variant="outline" onClick={restart} disabled={busy}>
      {busy ? "Restarting..." : "Restart gateway"}
    </Button>
  )
}
