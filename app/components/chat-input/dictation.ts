// Dictation: record with MediaRecorder, transcribe on our own speaches
// container via /api/voice/transcribe. Replaced the Web Speech API, which is
// Chrome-and-Safari-only and ships the audio to Google or Apple.

// Container formats in preference order. Chrome/Android/Firefox record webm;
// iOS Safari records only mp4. The upload's extension has to match: OpenAI-style
// transcription endpoints judge the format by the file name.
const FORMATS = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm" },
  { mimeType: "audio/webm", ext: "webm" },
  { mimeType: "audio/mp4", ext: "mp4" },
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
] as const

export type RecordingFormat = { mimeType: string; ext: string }

/** The first format this browser can record, or null (no MediaRecorder). */
export function recordingFormat(
  isTypeSupported: ((type: string) => boolean) | undefined = typeof MediaRecorder === "undefined"
    ? undefined
    : (type) => MediaRecorder.isTypeSupported(type)
): RecordingFormat | null {
  if (!isTypeSupported) return null
  return FORMATS.find((f) => isTypeSupported(f.mimeType)) ?? null
}

/** What to put in the textarea: what was typed before, plus what was said. */
export function mergeDictation(base: string, transcript: string): string {
  const spoken = transcript.trim()
  if (!spoken) return base
  if (!base) return spoken
  return base.endsWith(" ") ? base + spoken : `${base} ${spoken}`
}
