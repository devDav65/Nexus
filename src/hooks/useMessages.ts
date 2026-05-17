"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useMessages({ conversationId, initialMessages }: {
  conversationId: string
  initialMessages: any[]
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 30)
  const [loading, setLoading] = useState(false)

  // Reset quand on change de conversation
  useEffect(() => {
    setMessages(initialMessages)
    setHasMore(initialMessages.length >= 30)
  }, [conversationId])

  // Realtime uniquement — PAS de fetch initial
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const { data: fullMsg } = await supabase
          .from("messages")
          .select(`
            id, conversation_id, sender_id, content, type,
            status, reply_to_id, is_edited, is_deleted,
            created_at, metadata,
            sender:profiles(id, username, display_name, avatar_url),
            attachments(*), reactions(*)
          `)
          .eq("id", payload.new.id)
          .single()

        if (fullMsg) {
          setMessages(prev => {
            if (prev.find(m => m.id === fullMsg.id)) return prev
            return [...prev, fullMsg]
          })
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev =>
          prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || messages.length === 0) return
    setLoading(true)
    const oldest = messages[0]
    const { data } = await supabase
      .from("messages")
      .select(`
        id, conversation_id, sender_id, content, type,
        status, reply_to_id, is_edited, is_deleted,
        created_at, metadata,
        sender:profiles(id, username, display_name, avatar_url),
        attachments(*), reactions(*)
      `)
      .eq("conversation_id", conversationId)
      .eq("is_deleted", false)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(30)

    if (data) {
      if (data.length < 30) setHasMore(false)
      setMessages(prev => [...data.reverse(), ...prev])
    }
    setLoading(false)
  }, [conversationId, messages, loading, hasMore])

  return { messages, loadMore, hasMore, loading }
}

// Marquer les messages comme lus et mettre à jour leur statut
export async function markMessagesAsRead(
  conversationId: string,
  currentUserId: string
) {
  const supabase = createClient()

  // 1. Mettre à jour last_read_at du membre
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", currentUserId)

  // 2. Marquer tous les messages non-lus comme "read"
  await supabase
    .from("messages")
    .update({ status: "read" })
    .eq("conversation_id", conversationId)
    .neq("sender_id", currentUserId)
    .neq("status", "read")
}
