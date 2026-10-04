import { LayoutApp } from "@/app/components/layout/layout-app"
import { ProjectView } from "@/app/p/[projectId]/project-view"
import { getCurrentUser } from "@/lib/auth"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { db, schema } from "@/lib/db"
import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ projectId: string }>
}

export default async function Page({ params }: Props) {
  const { projectId } = await params

  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth")
  }

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)))

  if (!project) {
    redirect("/")
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ProjectView projectId={projectId} key={projectId} />
      </LayoutApp>
    </MessagesProvider>
  )
}
