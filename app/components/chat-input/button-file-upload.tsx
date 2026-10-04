import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "@/components/prompt-kit/file-upload"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileArrowUpIcon, PaperclipIcon } from "@phosphor-icons/react"
import React from "react"
import { PopoverContentAuth } from "./popover-content-auth"

type ButtonFileUploadProps = {
  onFileUpload: (files: File[]) => void
  isUserAuthenticated: boolean
  /** The `accept` list the current runtime + lane can actually use; null = none. */
  accept: string | null
}

const trigger = (
  <Button
    size="sm"
    variant="secondary"
    className="border-border dark:bg-secondary size-8 rounded-full border bg-transparent"
    type="button"
    aria-label="Add files"
  >
    <PaperclipIcon className="size-4" />
  </Button>
)

export function ButtonFileUpload({
  onFileUpload,
  isUserAuthenticated,
  accept,
}: ButtonFileUploadProps) {
  if (!accept || !isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add files</TooltipContent>
        </Tooltip>
        {accept ? (
          <PopoverContentAuth />
        ) : (
          <PopoverContent className="p-2">
            <div className="text-secondary-foreground text-sm">
              This model does not support file uploads.
              <br />
              Please select another model.
            </div>
          </PopoverContent>
        )}
      </Popover>
    )
  }

  return (
    <FileUpload onFilesAdded={onFileUpload} multiple accept={accept}>
      <Tooltip>
        <TooltipTrigger asChild>
          <FileUploadTrigger asChild>{trigger}</FileUploadTrigger>
        </TooltipTrigger>
        <TooltipContent>Add files</TooltipContent>
      </Tooltip>
      <FileUploadContent>
        <div className="border-input bg-background flex flex-col items-center rounded-lg border border-dashed p-8">
          <FileArrowUpIcon className="text-muted-foreground size-8" />
          <span className="mt-4 mb-1 text-lg font-medium">Drop files here</span>
          <span className="text-muted-foreground text-sm">
            Drop any files here to add it to the conversation
          </span>
        </div>
      </FileUploadContent>
    </FileUpload>
  )
}
