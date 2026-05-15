"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Video, MicOff, Mic, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface CallScreenProps {
  contact: any
  callType: "audio" | "video"
  onEnd: () => void
}

export default function CallScreen({ contact, callType, onEnd }: CallScreenProps) {
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [status, setStatus] = useState<"calling" | "connected">("calling")
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setStatus("connected"), 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (status !== "connected") return
    const t = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const name = contact?.display_name ?? (contact?.username ? `@${contact.username}` : "Contact")
  const initial = name.replace("@", "").charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col items-center justify-between py-16 px-6">
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className={cn(
          "rounded-full p-1",
          status === "calling" && "animate-pulse ring-2 ring-primary/50 ring-offset-2 ring-offset-zinc-900"
        )}>
          <Avatar className="w-24 h-24">
            <AvatarImage src={contact?.avatar_url ?? undefined} />
            <AvatarFallback className="text-3xl bg-primary/20 text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center">
          <p className="text-white text-xl font-semibold">{name}</p>
          <p className="text-white/60 text-sm mt-1">
            {status === "calling"
              ? (callType === "video" ? "Appel vidéo…" : "Appel audio…")
              : formatDuration(duration)
            }
          </p>
          {status === "connected" && (
            <p className="text-green-400 text-xs mt-0.5">● Connecté</p>
          )}
        </div>
      </div>

      {callType === "video" && status === "connected" && (
        <div className="w-full max-w-sm aspect-video bg-zinc-800 rounded-2xl flex items-center justify-center">
          {cameraOff
            ? <div className="flex flex-col items-center gap-2 text-white/30"><VideoOff className="w-8 h-8" /><p className="text-xs">Caméra désactivée</p></div>
            : <p className="text-white/20 text-xs">Vidéo en direct</p>
          }
        </div>
      )}

      <div className="flex items-center gap-8">
        <button
          onClick={() => setMuted(!muted)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-all",
            muted ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
          )}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-xl"
        >
          <Phone className="w-6 h-6 text-white rotate-[135deg]" />
        </button>

        {callType === "video" ? (
          <button
            onClick={() => setCameraOff(!cameraOff)}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all",
              cameraOff ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-14 h-14" />
        )}
      </div>
    </div>
  )
}
