import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"

// Wraps every cloud9 page (/customize, /scheduled, /projects) in the same app shell the rest of Zola uses, so sidebar/header render
// consistently without each page importing LayoutApp itself. MessagesProvider is required by
// the sidebar's chat item menu (delete/reset), same as app/p/[projectId]/page.tsx.
export default function Cloud9Layout({ children }: { children: React.ReactNode }) {
  return (
    <MessagesProvider>
      <LayoutApp>
        <div className="pt-app-header mx-auto w-full max-w-4xl px-6 pb-8 md:pt-8">{children}</div>
      </LayoutApp>
    </MessagesProvider>
  )
}
