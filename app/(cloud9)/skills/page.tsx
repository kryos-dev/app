import { redirect } from "next/navigation"

// Skills moved into the combined Customize page (Skills | Connectors tabs).
export default function SkillsPage() {
  redirect("/customize?tab=skills")
}
