"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import ChatHeader from "./ChatHeader"
import MessageList from "./MessageList"
import MessageInput from "./MessageInput"

interface ChatContainerProps {
  conversation: any
  initialMessages: any[]
  currentUserId: string
  currentUserProfile: any
}

export default function ChatContainer({
  conversation,
  initialMessages,
  currentUserId,
  currentUserProfile,
}: ChatContainerProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const channelRef = useRef<RealtimeChannel | null>(null)

  const membersMap = Object.fromEntries(
    (conversation.members ?? []).map((m: any) => [m.user_id, m.profile])
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Nettoyer l'ancien channel si existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channelName = `chat-${conversation.id}-${currentUserId}`

    const channel = supabase
      .channel(channelName, {
        config: { presence: { key: currentUserId } }
      })
      // Sans filtre — on filtre côté client
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as any
          // Filtrer côté client
          if (newMsg.conversation_id !== conversation.id) return
          if (newMsg.is_deleted) return

          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev
            const sender = membersMap[newMsg.sender_id] ?? {
              id: newMsg.sender_id,
              display_name: null,
              username: null,
              avatar_url: null,
            }
            return [...prev, { ...newMsg, sender, reactions: [] }]
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updated = payload.new as any
          if (updated.conversation_id !== conversation.id) return
          setMessages((prev) =>
            prev.map((m) => m.id === updated.id ? { ...m, ...updated } : m)
          )
        }
      )
      // Typing via Broadcast (plus fiable que Presence pour ça)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { user_id, display_name, is_typing } = payload.payload
        if (user_id === currentUserId) return

        setTypingUsers((prev) => {
          if (is_typing) {
            return prev.includes(display_name) ? prev : [...prev, display_name]
          } else {
            return prev.filter((u) => u !== display_name)
          }
        })
      })

    channelRef.current = channel

    channel.subscribe((status, err) => {
      console.log("🔌 Realtime status:", status, err ?? "")
      if (status === "SUBSCRIBED") {
        setConnected(true)
        console.log("✅ Realtime connecté pour", conversation.id)
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("❌ Realtime erreur:", status)
        setConnected(false)
      }
    })

    return () => {
      clearTimeout(typingTimeoutRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversation.id, currentUserId])

  const sendMessage = async (content: string) => {
    if (!content.trim()) return
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: content.trim(),
      type: "text",
    })
    if (error) console.error("Erreur envoi:", error)
  }

  const handleTyping = async (isTyping: boolean) => {
    if (!channelRef.current) return

    await channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: currentUserId,
        display_name: currentUserProfile?.display_name ?? currentUserProfile?.username ?? "Utilisateur",
        is_typing: isTyping,
      },
    })

    if (isTyping) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 2000)
    }
  }

  const isDM = conversation.type === "direct"
  const otherMember = isDM
    ? conversation.members?.find((m: any) => m.user_id !== currentUserId)
    : null

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation}
        otherMember={otherMember}
        currentUserId={currentUserId}
      />
      {/* Indicateur connexion realtime */}
      {!connected && (
        <div className="text-center text-xs text-muted-foreground py-1 bg-yellow-500/10">
          Connexion temps réel en cours...
        </div>
      )}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsers={typingUsers}
        bottomRef={bottomRef}
      />
      <MessageInput
        onSend={sendMessage}
        onTyping={handleTyping}
        disabled={false}
      />
    </div>
  )
}
