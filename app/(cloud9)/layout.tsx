import { LayoutApp } from "@/app/components/layout/layout-app"

// Wraps every cloud9 page (/customize, /scheduled, /projects) in the same app shell the rest of Zola uses, so sidebar/header render
// consistently without each page importing LayoutApp itself.
export default function Cloud9Layout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutApp>
      <div className="pt-app-header mx-auto w-full max-w-4xl px-6 pb-8 md:pt-8">{children}</div>
    </LayoutApp>
  )
}
