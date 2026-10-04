import { redirect } from "next/navigation"

// Connectors moved into the combined Customize page (Skills | Connectors tabs).
export default function ConnectorsPage() {
  redirect("/customize?tab=connectors")
}
