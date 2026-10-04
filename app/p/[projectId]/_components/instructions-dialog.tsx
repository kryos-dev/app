"use client"

// Shared by the projects list page and the project view's right rail --
// pulled out so the "edit instructions" mutation exists in exactly one place
// instead of being copy-pasted between them.

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type InstructionsDialogProps = {
  projectId: string
  systemPrompt: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstructionsDialog({
  projectId,
  systemPrompt,
  open,
  onOpenChange,
}: InstructionsDialogProps) {
  const [text, setText] = useState(systemPrompt ?? "")
  const queryClient = useQueryClient()

  // Re-sync when the dialog is (re)opened for a possibly different project.
  useEffect(() => {
    if (open) setText(systemPrompt ?? "")
  }, [open, systemPrompt])

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({ systemPrompt: text }),
      })
      if (!res.ok) throw new Error("Failed to save instructions")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project instructions</DialogTitle>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={6}
          placeholder="What should every chat in this project know? Context, conventions, tone, the repo it is about."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save instructions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
