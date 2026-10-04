import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

// The chat itself is rendered by ../../layout.tsx.
export default async function Page() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth")
  }
  return null
}
