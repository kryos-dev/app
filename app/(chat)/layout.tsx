import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"

// The chat lives in the LAYOUT shared by "/" and "/c/[chatId]", not in each
// page. Sending the first message pushes /c/<id>; with the chat inside two
// different pages Next swapped the page and remounted the whole tree, which
// unmounted useChat, aborted the reply mid-stream and started over from an
// empty chat ("streaming text disappearing"). A layout survives
// navigation between its pages, so the live chat does too. Chat keys its
// session by chat id, so switching chats is the only thing that remounts it.
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutApp>
      <ChatContainer />
      {children}
    </LayoutApp>
  )
}
