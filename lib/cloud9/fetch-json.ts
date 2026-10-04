// Shared server-side fetch helper for the cloud9 backend clients (Hermes, dashboard).
// Normalizes network/timeout/HTTP errors into one result shape so pages can render
// loading / error / data without each client reinventing try/catch.

export type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  timeoutMs = 8000
): Promise<JsonResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" })
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      data = text
    }
    if (!res.ok) {
      const errObj = data as { error?: { message?: string } | string } | undefined
      const message =
        (typeof errObj?.error === "string" ? errObj.error : errObj?.error?.message) ||
        res.statusText ||
        `HTTP ${res.status}`
      return { ok: false, status: res.status, error: String(message) }
    }
    return { ok: true, data: data as T }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out"
          : err.message
        : "Unknown error"
    return { ok: false, status: 0, error: message }
  } finally {
    clearTimeout(timer)
  }
}
