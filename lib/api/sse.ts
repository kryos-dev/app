import type { SseEvent } from '../types';

// Parses a text/event-stream body into typed events. Comment lines (keep-alives) and
// non-JSON data are skipped; keep-alive form is unspecified (contracts 2.5 [?]).
export async function* parseSse(res: Response): AsyncGenerator<SseEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming body not supported');
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value, { stream: !done });
      const frames = buf.split(/\r?\n\r?\n/);
      buf = done ? '' : frames.pop() ?? '';
      for (const frame of frames) {
        const ev = parseFrame(frame);
        if (ev) yield ev;
      }
      if (done) return;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function parseFrame(frame: string): SseEvent | null {
  const lines = frame.split(/\r?\n/);
  const name = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
  const data = lines
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    const ev = JSON.parse(data) as SseEvent;
    // Payloads carry `type` (contracts 2.5); fall back to the SSE event name if one is ever missing.
    if (!ev.type && name) (ev as { type: string }).type = name;
    return ev;
  } catch {
    return null;
  }
}
