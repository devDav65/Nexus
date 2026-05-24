"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import IncomingCallBanner from "./IncomingCallBanner"
import CallScreen from "./CallScreen"

export default function GlobalCallProvider({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient()
  const [activeCall, setActiveCall] = useState<{
    callId: string
    contact: any
    callType: "audio" | "video"
    isInitiator: boolean
  } | null>(null)

  // Écouter la table calls pour les changements de statut (ended, rejected)
  useEffect(() => {
    if (!activeCall) return

    const channel = supabase
      .channel(`call_status_${activeCall.callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${activeCall.callId}`,
        },
        (payload) => {
          const status = payload.new.status
          console.log("Call status changé:", status)
          if (["ended", "rejected", "missed"].includes(status)) {
            setActiveCall(null)
          }
        }
      )
      // Écouter aussi le broadcast end_call directement
      .on("broadcast", { event: `end_call_${activeCall.callId}` }, () => {
        console.log("end_call broadcast reçu dans GlobalCallProvider")
        setActiveCall(null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeCall?.callId])

  const handleAcceptCall = (call: any) => {
    setActiveCall({
      callId: call.id,
      contact: call.caller,
      callType: call.type,
      isInitiator: false,
    })
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
    <IncomingCallBanner
      currentUserId={currentUserId}
      onAccept={handleAcceptCall}
    />
  )
}
