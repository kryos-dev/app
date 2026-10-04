import { redirect } from "next/navigation"

// There is no login page here any more. Anything that still links to /auth --
// an old bookmark, the "Sign in" affordances in the chat input -- lands on the
// one login screen this box has.
//
// In practice nobody sees this: Caddy asks the access service about every request to
// chat.kryos.dev, so an unauthenticated browser is redirected before it gets
// this far. It is here for the case where it does.
export default function AuthPage() {
  redirect(process.env.AUTH_URL || "https://auth.kryos.dev/")
}
