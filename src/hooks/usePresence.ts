"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function usePresence(userId: string) {
    const supabase = createClient()

    useEffect(() => {
        const setStatus = async (status: "online" | "offline" | "away") => {
            await supabase
                .from("profiles")
                .update({
                    status,
                    last_seen_at: new Date().toISOString(),
                })
                .eq("id", userId)
        }

        // Marquer online au montage
        setStatus("online")

        // Heartbeat toutes les 30s
        const heartbeat = setInterval(() => setStatus("online"), 30_000)

        // Gérer la visibilité de l'onglet
        const handleVisibility = () => {
            setStatus(document.visibilityState === "visible" ? "online" : "away")
        }

        // Marquer offline avant fermeture
        const handleUnload = () => {
            // sendBeacon pour fiabilité
            navigator.sendBeacon(
                "/api/presence/offline",
                JSON.stringify({ userId })
            )
        }

        document.addEventListener("visibilitychange", handleVisibility)
        window.addEventListener("beforeunload", handleUnload)

        return () => {
            setStatus("offline")
            clearInterval(heartbeat)
            document.removeEventListener("visibilitychange", handleVisibility)
            window.removeEventListener("beforeunload", handleUnload)
        }
    }, [userId])
}
