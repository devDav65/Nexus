"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface UseTypingOptions {
    conversationId: string
    currentUserId: string
    currentUsername: string
}

export function useTyping({
                              conversationId,
                              currentUserId,
                              currentUsername,
                          }: UseTypingOptions) {
    const supabase = createClient()
    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})
    const channelRef = useRef<any>(null)

    useEffect(() => {
        // Canal broadcast pour le typing
        const channel = supabase.channel(`typing:${conversationId}`, {
            config: { broadcast: { self: false } },
        })

        channel
            .on("broadcast", { event: "typing_start" }, ({ payload }) => {
                if (payload.user_id === currentUserId) return

                const name = payload.username as string
                setTypingUsers((prev) =>
                    prev.includes(name) ? prev : [...prev, name]
                )

                // Supprimer après 3s sans signal
                clearTimeout(timeoutsRef.current[name])
                timeoutsRef.current[name] = setTimeout(() => {
                    setTypingUsers((prev) => prev.filter((u) => u !== name))
                }, 3000)
            })
            .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
                const name = payload.username as string
                clearTimeout(timeoutsRef.current[name])
                setTypingUsers((prev) => prev.filter((u) => u !== name))
            })
            .subscribe()

        channelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
            Object.values(timeoutsRef.current).forEach(clearTimeout)
        }
    }, [conversationId, currentUserId])

    // Envoyer l'événement typing (appelé à chaque frappe)
    const stopTimeoutRef = useRef<NodeJS.Timeout>()

    const sendTypingEvent = useCallback(() => {
        channelRef.current?.send({
            type: "broadcast",
            event: "typing_start",
            payload: { user_id: currentUserId, username: currentUsername },
        })

        // Auto-stop après 2s sans frappe
        clearTimeout(stopTimeoutRef.current)
        stopTimeoutRef.current = setTimeout(() => {
            channelRef.current?.send({
                type: "broadcast",
                event: "typing_stop",
                payload: { user_id: currentUserId, username: currentUsername },
            })
        }, 2000)
    }, [currentUserId, currentUsername])

    return { typingUsers, sendTypingEvent }
}