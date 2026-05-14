"use client"
import { RefObject } from "react"
import MessageBubble from "./MessageBubble"

interface MessageListProps {
  messages: any[]
  currentUserId: string
  typingUsers: string[]
  bottomRef: RefObject<HTMLDivElement>
}

export default function MessageList({ messages, currentUserId, typingUsers, bottomRef }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Aucun message. Soyez le premier à écrire !</p>
        </div>
      )}
      {messages.map((msg, i) => {
        const prevMsg = messages[i - 1]
        const msgSenderId = msg.sender_id ?? msg.sender?.id
        const prevSenderId = prevMsg ? (prevMsg.sender_id ?? prevMsg.sender?.id) : null
        const isOwn = msgSenderId === currentUserId
        const showAvatar = !isOwn && prevSenderId !== msgSenderId
        const isGrouped = !!prevMsg && prevSenderId === msgSenderId &&
          new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000
        return (
          <MessageBubble key={msg.id} message={msg} isOwn={isOwn} showAvatar={showAvatar} isGrouped={isGrouped} />
        )
      })}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground">{typingUsers.join(", ")} est en train d'écrire…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
