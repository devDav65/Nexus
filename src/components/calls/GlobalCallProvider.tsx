"use client"

import { useState } from "react"
import IncomingCallBanner from "./IncomingCallBanner"
import CallScreen from "./CallScreen"

export default function GlobalCallProvider({ currentUserId }: { currentUserId: string }) {
  const [activeCall, setActiveCall] = useState<{
    callId: string; contact: any; callType: "audio" | "video"; isInitiator: boolean
  } | null>(null)

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
      onAccept={(call) => setActiveCall({
        callId: call.id,
        contact: call.caller,
        callType: call.type,
        isInitiator: false,
      })}
    />
  )
}
