import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"

// The chat lives in the LAYOUT shared by "/" and "/c/[chatId]", not in each
// page. Sending the first message pushes /c/<id>; with the chat inside two
// different pages Next swapped the page and remounted the whole tree, which
// unmounted useChat, aborted the reply mid-stream and started over from an
// empty chat ("streaming text disappearing"). A layout survives
// navigation between its pages, so the live chat does too.
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
        {children}
      </LayoutApp>
    </MessagesProvider>
  )
}
