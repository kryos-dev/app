import { fetchClient } from "@/lib/fetch"
import type { UserProfile } from "@/lib/user/types"

export async function fetchUserProfile(
  _id: string
): Promise<UserProfile | null> {
  const res = await fetchClient("/api/user")
  if (!res.ok) return null
  return res.json()
}

export async function updateUserProfile(
  _id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  const res = await fetchClient("/api/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  return res.ok
}

export async function signOutUser(): Promise<boolean> {
  // The access service holds the session; signing out is a navigation to it.
  window.location.assign("https://auth.kryos.dev/api/logout")
  return true
}

// ponytail: no realtime backend (no Supabase Realtime equivalent wired up).
// Single-user app updates the local store optimistically on every mutation,
// so cross-tab sync is the only thing this drops. Add polling or SSE if that
// ever matters.
export function subscribeToUserUpdates(
  _userId: string,
  _onUpdate: (newData: Partial<UserProfile>) => void
) {
  return () => {}
}
