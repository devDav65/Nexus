"use client"

import { useRef, useEffect } from "react"
import { useMessages } from "@/hooks/useMessages"
import { useTyping } from "@/hooks/useTyping"
import { usePresence } from "@/hooks/usePresence"
import ChatHeader from "@/components/chat/ChatHeader"
import MessageList from "@/components/chat/MessageList"
import MessageInput from "@/components/chat/MessageInput"

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

    usePresence(currentUserId)

    const { messages, loadMore, hasMore, loading } = useMessages({
        conversationId: conversation.id,
        initialMessages,
    })

    const currentMember = conversation.members?.find(
        (m: any) => m.user_id === currentUserId
    )
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

    // ── LOG CLIENT — supprime après confirmation ──────────
    useEffect(() => {
        console.log("=== CLIENT DEBUG ===")
        console.log("currentUserId:", currentUserId)
        console.log("messages.length:", messages.length)
        if (messages.length > 0) {
            console.log("msg[0].sender_id:", messages[0].sender_id)
            console.log("isOwn[0]:", messages[0].sender_id === currentUserId)
            // Chercher un message de l'autre utilisateur
            const otherMsg = messages.find(m => m.sender_id !== currentUserId)
            if (otherMsg) {
                console.log("autre sender_id:", otherMsg.sender_id)
                console.log("isOwn autre:", otherMsg.sender_id === currentUserId)
            }
        }
        console.log("====================")
    }, [messages, currentUserId])
    // ─────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            <ChatHeader
                conversation={conversation}
                otherMember={otherMember}
                currentUserId={currentUserId}
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