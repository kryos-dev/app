// Server-side client for the Hermes gateway reads this app still makes.
// The bearer key never reaches the browser.
import { fetchJson } from "./fetch-json"

const BASE = process.env.HERMES_API_URL || ""
const KEY = process.env.HERMES_API_KEY || ""

function get<T>(path: string) {
  return fetchJson<T>(`${BASE}${path}`, {
    headers: KEY ? { Authorization: `Bearer ${KEY}` } : {},
  })
}

export type HermesHealth = { status: string; platform: string; version: string }

export type HermesSession = {
  id: string
  title: string
  model: string
  started_at: number
  last_active: number
  message_count: number
}

export const hermes = {
  health: () => get<HermesHealth>("/health"),
  sessions: () => get<{ object: string; data: HermesSession[] }>("/api/sessions"),
}
