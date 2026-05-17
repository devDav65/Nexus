"use client"

import { useRef, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useMessages } from "@/hooks/useMessages"
import { useTyping } from "@/hooks/useTyping"
import { usePresence } from "@/hooks/usePresence"
import ChatHeader from "@/components/chat/ChatHeader"
import MessageList from "@/components/chat/MessageList"
import MessageInput from "@/components/chat/MessageInput"
import CallScreen from "@/components/calls/CallScreen"

interface Props {
  conversation: any
  initialMessages: any[]
  currentUserId: string
}

export default function ChatClient({ conversation, initialMessages, currentUserId }: Props) {
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [activeCall, setActiveCall] = useState<{
    callId: string; contact: any; callType: "audio" | "video"; isInitiator: boolean
  } | null>(null)

  usePresence(currentUserId)

  const { messages, loadMore, hasMore, loading } = useMessages({ conversationId: conversation.id, initialMessages })

  const currentMember = conversation.members?.find((m: any) => m.user_id === currentUserId)
  const currentUsername = currentMember?.profile?.display_name ?? currentMember?.profile?.username ?? "Quelqu'un"

  const { typingUsers, sendTypingEvent } = useTyping({
    conversationId: conversation.id, currentUserId, currentUsername,
  })

  const otherMember = conversation.type === "direct"
    ? conversation.members?.find((m: any) => m.user_id !== currentUserId)
    : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const startCall = async (type: "audio" | "video") => {
    if (!otherMember?.profile) return
    const { data: call, error } = await supabase
      .from("calls")
      .insert({ caller_id: currentUserId, callee_id: otherMember.profile.id, type, status: "ringing" })
      .select("id").single()

    if (!error && call) {
      setActiveCall({ callId: call.id, contact: otherMember.profile, callType: type, isInitiator: true })
    }
  }

  if (activeCall) {
    return (
      <CallScreen
        callId={activeCall.callId}
        contact={activeCall.contact}
        callType={activeCall.callType}
        currentUserId={currentUserId}
        isInitiator={activeCall.isInitiator}
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
        onAudioCall={() => startCall("audio")}
        onVideoCall={() => startCall("video")}
      />
      <MessageList
        messages={messages} currentUserId={currentUserId}
        typingUsers={typingUsers} bottomRef={bottomRef}
        onLoadMore={loadMore} hasMore={hasMore} loading={loading}
      />
      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
        onTyping={(isTyping) => { if (isTyping) sendTypingEvent() }}
        onSend={async (text) => {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: currentUserId,
            content: text,
            type: "text",
            status: "sent",
          })
        }}
      />
    </div>
  )
}
