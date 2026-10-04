"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ConnectorsPanel } from "./_components/connectors-panel"
import { PersonalizationPanel } from "./_components/personalization-panel"
import { SkillsPanel } from "./_components/skills-panel"

type Tab = "skills" | "connectors" | "personalization"
type View = "yours" | "discover"

const TABS: Tab[] = ["skills", "connectors", "personalization"]

// Claude.ai's Customize layout: Skills | Connectors on top, then a per-tab
// toolbar (Yours | Discover, search, sort, Add). Plugins is skipped -- there
// is no Hermes API for it yet.
function CustomizeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get("tab") as Tab
  const tab: Tab = TABS.includes(tabParam) ? tabParam : "skills"
  const view: View = searchParams.get("view") === "discover" ? "discover" : "yours"

  const setParams = (next: { tab?: Tab; view?: View }) => {
    const params = new URLSearchParams(searchParams)
    if (next.tab) params.set("tab", next.tab)
    if (next.view) params.set("view", next.view)
    router.replace(`/customize?${params.toString()}`)
  }

  return (
    <div>
      <PageHeader title="Customize" />

      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v as Tab, view: "yours" })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="personalization">Personalization</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "skills" ? (
        <SkillsPanel view={view} onViewChange={(v) => setParams({ view: v })} />
      ) : tab === "connectors" ? (
        <ConnectorsPanel view={view} onViewChange={(v) => setParams({ view: v })} />
      ) : (
        <PersonalizationPanel />
      )}
    </div>
  )
}

export default function CustomizePage() {
  return (
    <Suspense>
      <CustomizeInner />
    </Suspense>
  )
}
