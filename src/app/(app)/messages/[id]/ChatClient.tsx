"use client"

import { useRef, useEffect, useState } from "react"
import { useMessages } from "@/hooks/useMessages"
import { useTyping } from "@/hooks/useTyping"
import { usePresence } from "@/hooks/usePresence"
import ChatHeader from "@/components/chat/ChatHeader"
import MessageList from "@/components/chat/MessageList"
import MessageInput from "@/components/chat/MessageInput"
import CallScreen from "@/components/calls/CallScreen"

interface ChatClientProps {
  conversation: any
  initialMessages: any[]
  currentUserId: string
}

export default function ChatClient({
  conversation,
  initialMessages,
  currentUserId,
}: ChatClientProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [activeCall, setActiveCall] = useState<{ type: "audio" | "video"; contact: any } | null>(null)

  usePresence(currentUserId)

  const { messages, loadMore, hasMore, loading } = useMessages({
    conversationId: conversation.id,
    initialMessages,
  })

  const currentMember = conversation.members?.find((m: any) => m.user_id === currentUserId)
  const currentUsername =
    currentMember?.profile?.display_name ??
    currentMember?.profile?.username ??
    "Quelqu'un"

  const { typingUsers, sendTypingEvent } = useTyping({
    conversationId: conversation.id,
    currentUserId,
    currentUsername,
  })

  const otherMember =
    conversation.type === "direct"
      ? conversation.members?.find((m: any) => m.user_id !== currentUserId)
      : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Appel actif → afficher CallScreen
  if (activeCall) {
    return (
      <CallScreen
        contact={activeCall.contact}
        callType={activeCall.type}
        onEnd={() => setActiveCall(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation}
        otherMember={otherMember}
        currentUserId={currentUserId}
        onAudioCall={() => setActiveCall({ type: "audio", contact: otherMember?.profile })}
        onVideoCall={() => setActiveCall({ type: "video", contact: otherMember?.profile })}
      />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsers={typingUsers}
        bottomRef={bottomRef}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loading={loading}
      />
      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
        onTyping={sendTypingEvent}
      />
    </div>
  )
}
