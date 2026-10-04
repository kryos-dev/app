"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"

export function TanstackQueryProvider({ children }: { children: ReactNode }) {
  // One retry, not the default three with exponential backoff. The admin pages
  // (Skills, Scheduled, Connectors) proxy to the Hermes dashboard, and when
  // that answers 401 or is down the default retries kept "Loading…" on screen
  // for ten seconds before the error appeared.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
  )
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
