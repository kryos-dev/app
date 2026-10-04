import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MicrophoneIcon, StopIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { mergeDictation, recordingFormat } from "./dictation"

type ButtonVoiceProps = {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

type State = "idle" | "recording" | "transcribing"

// Dictation: tap to record, tap to stop, transcribed by /api/voice/transcribe.
// Absent where MediaRecorder/getUserMedia is missing (insecure origin, old
// browser).
export function ButtonVoice({ value, onValueChange, disabled }: ButtonVoiceProps) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<State>("idle")
  const recorder = useRef<MediaRecorder | null>(null)
  // The transcript lands after an upload round trip; read the input as it is
  // THEN, so anything typed meanwhile is kept.
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    setSupported(!!recordingFormat() && !!navigator.mediaDevices?.getUserMedia)
    return () => {
      const r = recorder.current
      if (r) {
        r.ondataavailable = null
        r.onstop = null
        if (r.state !== "inactive") r.stop()
        r.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  if (!supported) return null

  const transcribe = async (blob: Blob, ext: string) => {
    setState("transcribing")
    try {
      const form = new FormData()
      form.append("file", blob, `dictation.${ext}`)
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form })
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      onValueChange(mergeDictation(latest.current, body.text ?? ""))
    } catch (err) {
      toast({ title: `Transcription failed: ${(err as Error).message}`, status: "error" })
    } finally {
      setState("idle")
    }
  }

  const start = async () => {
    const format = recordingFormat()
    if (!format) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      toast({ title: `Microphone unavailable: ${(err as Error).message}`, status: "error" })
      return
    }
    const r = new MediaRecorder(stream, { mimeType: format.mimeType })
    const chunks: Blob[] = []
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      recorder.current = null
      const blob = new Blob(chunks, { type: r.mimeType || format.mimeType })
      if (blob.size) void transcribe(blob, format.ext)
      else setState("idle")
    }
    recorder.current = r
    r.start()
    setState("recording")
  }

  const recording = state === "recording"
  const label = recording ? "Stop dictating" : state === "transcribing" ? "Transcribing" : "Dictate"

  return (
    <ButtonGroup aria-label="Voice">
      {supported && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant={recording ? "destructive" : "outline"}
              className="rounded-full"
              type="button"
              disabled={disabled || state === "transcribing"}
              onClick={() => (recording ? recorder.current?.stop() : void start())}
              aria-label={label}
              aria-pressed={recording}
            >
              {state === "transcribing" ? (
                <Spinner />
              ) : recording ? (
                <StopIcon className="size-4" weight="fill" />
              ) : (
                <MicrophoneIcon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      )}
    </ButtonGroup>
  )
}
