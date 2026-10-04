import { toMessageDTO } from "@/app/api/chats/utils"
import { APP_DOMAIN } from "@/lib/config"
import { db, schema } from "@/lib/db"
import { and, asc, eq } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Article from "./article"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>
}): Promise<Metadata> {
  const { chatId } = await params
  const [chat] = await db
    .select({ title: schema.chats.title, createdAt: schema.chats.createdAt })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.public, true)))

  const title = chat?.title || "Chat"
  const description = "A chat in Zola"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_DOMAIN}/share/${chatId}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ShareChat({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params

  // Only a chat its owner marked public is readable here. Without that filter
  // this page handed the full transcript of any chat to anyone holding its id.
  const [chatData] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.public, true)))

  if (!chatData) {
    redirect("/")
  }

  const messagesData = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
    .orderBy(asc(schema.messages.createdAt))

  return (
    <Article
      messages={messagesData.map(toMessageDTO) as never}
      date={(chatData.createdAt || new Date()).toString()}
      title={chatData.title || ""}
      subtitle={"A conversation in Zola"}
    />
  )
}
