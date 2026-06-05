"use client"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Video, MicOff, Mic, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWebRTC, CallEndReason } from "@/hooks/useWebRTC"

interface Props {
  callId: string
  contact: any
  callType: "audio" | "video"
  currentUserId: string
  isInitiator: boolean
  onEnd: () => void
}

const END_MESSAGES: Record<string, string> = {
  ended: "Appel terminé",
  rejected: "Appel refusé",
  missed: "Appel manqué",
  error: "Erreur de connexion",
}

export default function CallScreen({ callId, contact, callType, currentUserId, isInitiator, onEnd }: Props) {
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [duration, setDuration] = useState(0)
  const [endMessage, setEndMessage] = useState<string | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const endTimerRef = useRef<NodeJS.Timeout>()

  const handleEndReason = (reason: CallEndReason) => {
    const msg = END_MESSAGES[reason ?? "ended"] ?? "Appel terminé"
    setEndMessage(msg)
    endTimerRef.current = setTimeout(onEnd, 2500)
  }

  const { localStream, callState, endCall, toggleMute, toggleCamera } = useWebRTC({
    callId, currentUserId, isInitiator, callType,
    onStateChange: (state) => {
      if (state === "ended" && !endMessage) {
        setEndMessage("Appel terminé")
        endTimerRef.current = setTimeout(onEnd, 2500)
      }
    },
    onEndReason: handleEndReason,
    onRemoteStream: (stream) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
    },
  })

  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (callState !== "connected") return
    const t = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [callState])

  useEffect(() => () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  const name = contact?.display_name ?? (contact?.username ? `@${contact.username}` : "Contact")
  const initial = name.replace("@", "").charAt(0).toUpperCase()

  const handleEnd = async () => {
    await endCall("ended")
    setEndMessage("Appel terminé")
    endTimerRef.current = setTimeout(onEnd, 2500)
  }

  if (endMessage) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col items-center justify-center gap-6">
        <Avatar className="w-24 h-24">
          <AvatarImage src={contact?.avatar_url ?? undefined} />
          <AvatarFallback className="text-3xl bg-primary/20 text-primary">{initial}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-white text-xl font-semibold">{name}</p>
          <p className={cn("mt-2 text-lg font-medium",
            endMessage.includes("refusé") ? "text-red-400" :
            endMessage.includes("terminé") ? "text-white/60" : "text-yellow-400")}>
            {endMessage === "Appel terminé" ? "📵" :
             endMessage === "Appel refusé" ? "❌" : "⚠️"} {endMessage}
          </p>
          {duration > 0 && <p className="text-white/40 text-sm mt-1">Durée : {fmt(duration)}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col">
      {callType === "video" ? (
        <div className="flex-1 relative bg-zinc-800">
          {callState === "connected"
            ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full flex items-center justify-center flex-col gap-4">
                <Avatar className={cn("w-28 h-28", callState === "calling" && "animate-pulse ring-4 ring-primary/40 ring-offset-4 ring-offset-zinc-900")}>
                  <AvatarImage src={contact?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-4xl bg-primary/20 text-primary">{initial}</AvatarFallback>
                </Avatar>
                <p className="text-white text-xl font-semibold">{name}</p>
                <p className="text-white/60">{isInitiator ? "Appel vidéo…" : "Connexion…"}</p>
              </div>
            )
          }
          <div className="absolute bottom-28 right-3 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 bg-zinc-700">
            <video ref={localVideoRef} autoPlay muted playsInline className={cn("w-full h-full object-cover", cameraOff && "hidden")} />
            {cameraOff && <div className="w-full h-full flex items-center justify-center"><VideoOff className="w-5 h-5 text-white/30" /></div>}
          </div>
          {callState === "connected" && (
            <div className="absolute top-4 left-0 right-0 flex flex-col items-center">
              <p className="text-white text-sm font-semibold">{name}</p>
              <p className="text-white/60 text-xs">{fmt(duration)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Avatar className={cn("w-28 h-28", callState === "calling" && "animate-pulse ring-4 ring-primary/40 ring-offset-4 ring-offset-zinc-900")}>
            <AvatarImage src={contact?.avatar_url ?? undefined} />
            <AvatarFallback className="text-4xl bg-primary/20 text-primary">{initial}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-white text-2xl font-semibold">{name}</p>
            <p className="text-white/60 mt-2">
              {callState === "calling" ? "Sonnerie…" : callState === "ringing" ? "Connexion…" : callState === "connected" ? fmt(duration) : "Fin de l'appel"}
            </p>
            {callState === "connected" && <p className="text-green-400 text-sm mt-1">● Connecté</p>}
          </div>
        </div>
      )}
      <div className="shrink-0 flex items-center justify-center gap-8 pb-12 pt-6 bg-zinc-900">
        <button onClick={() => setMuted(toggleMute())} className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all", muted ? "bg-white text-zinc-900" : "bg-zinc-700 text-white hover:bg-zinc-600")}>
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={handleEnd} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl">
          <Phone className="w-6 h-6 text-white rotate-[135deg]" />
        </button>
        {callType === "video" ? (
          <button onClick={() => setCameraOff(toggleCamera())} className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all", cameraOff ? "bg-white text-zinc-900" : "bg-zinc-700 text-white hover:bg-zinc-600")}>
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        ) : <div className="w-14 h-14" />}
      </div>
    </div>
  )
}
