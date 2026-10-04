import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { db, schema } from "@/lib/db"

/**
 * The person's row, created on first sign-in.
 *
 * This used to be "the single row", because the app had one hard-coded
 * account. It is keyed by username now: the directory decides who exists, and
 * a row appears here the first time each of them signs in. Everything else --
 * chats, projects, preferences -- already hangs off users.id, so the rest of
 * the app became multi-user by this function doing a lookup.
 */
export async function getOrCreateUser(
  username: string,
  profile: { email?: string | null; displayName?: string | null } = {}
) {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  if (existing) return existing

  const [created] = await db
    .insert(schema.users)
    .values({
      username,
      email: profile.email || `${username}@kryos.dev`,
      displayName: profile.displayName || username,
      // Empty, not the default lane: the picker treats a non-empty favourites
      // list as a whitelist and hides everything else, so seeding it with the
      // default lane left the operator staring at a one-model picker.
      favoriteModels: [],
    })
    .returning()
  return created
}

/**
 * Returns the signed-in person's row, or null.
 *
 * There is no password, no session cookie and no login page here. The access
 * service authenticates, Caddy asks
 * it about every request to chat.kryos.dev, and the username arrives in a
 * header only Caddy can set: nothing reaches this process without passing
 * through that block, so the header is the identity.
 *
 * AUTH_DEV_USER exists because `next dev` on a laptop has no proxy in front of
 * it. It is opt-in by env var and unset in production, where an absent header
 * has to mean nobody.
 */
export async function getCurrentUser() {
  const requestHeaders = await headers()
  const username =
    requestHeaders.get("remote-user") || process.env.AUTH_DEV_USER || null
  if (!username) return null

  return getOrCreateUser(username, {
    email: requestHeaders.get("remote-email"),
    displayName: requestHeaders.get("remote-name"),
  })
}
