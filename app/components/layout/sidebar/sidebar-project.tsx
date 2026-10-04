"use client"

import { FolderPlusIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { DialogCreateProject } from "./dialog-create-project"
import { SidebarProjectItem } from "./sidebar-project-item"

type Project = {
  id: string
  name: string
  user_id: string
  created_at: string
}

// Same cutoff as the project page's lists so the sidebar never grows past a screen.
const PREVIEW_ROWS = 5

export function SidebarProject() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects")
      if (!response.ok) {
        throw new Error("Failed to fetch projects")
      }
      return response.json()
    },
  })

  return (
    <div className="mb-5">
      <button
        className="hover:bg-accent/80 hover:text-foreground text-primary group/new-chat relative inline-flex w-full items-center rounded-md bg-transparent px-2 py-2 text-sm transition-colors"
        type="button"
        onClick={() => setIsDialogOpen(true)}
      >
        <div className="flex items-center gap-2">
          <FolderPlusIcon size={20} />
          New project
        </div>
      </button>

      {isLoading ? null : (
        <div className="space-y-1">
          {(expanded ? projects : projects.slice(0, PREVIEW_ROWS)).map((project) => (
            <SidebarProjectItem key={project.id} project={project} />
          ))}
          {projects.length > PREVIEW_ROWS ? (
            <button
              type="button"
              className="hover:bg-accent/80 text-muted-foreground hover:text-foreground w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : `Show ${projects.length - PREVIEW_ROWS} more`}
            </button>
          ) : null}
        </div>
      )}

      <DialogCreateProject isOpen={isDialogOpen} setIsOpen={setIsDialogOpen} />
    </div>
  )
}
