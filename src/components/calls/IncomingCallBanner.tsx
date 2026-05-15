"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, PhoneOff, Video } from "lucide-react"

interface Props {
  currentUserId: string
  onAccept: (call: any) => void
}

export default function IncomingCallBanner({ currentUserId, onAccept }: Props) {
  const supabase = createClient()
  const [call, setCall] = useState<any | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`incoming:${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${currentUserId}` },
        async (payload) => {
          const { data: caller } = await supabase.from("profiles")
            .select("id, username, display_name, avatar_url").eq("id", payload.new.caller_id).single()
          setCall({ ...payload.new, caller })
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${currentUserId}` },
        (payload) => {
          if (["ended", "missed", "rejected"].includes(payload.new.status)) setCall(null)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const accept = async () => {
    if (!call) return
    await supabase.from("calls").update({ status: "active", started_at: new Date().toISOString() }).eq("id", call.id)
    onAccept(call)
    setCall(null)
  }

  const reject = async () => {
    if (!call) return
    await supabase.from("calls").update({ status: "rejected", ended_at: new Date().toISOString() }).eq("id", call.id)
    setCall(null)
  }

  if (!call) return null

  const name = call.caller?.display_name ?? (call.caller?.username ? `@${call.caller.username}` : "Quelqu'un")

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-slide-up">
      <div className="bg-zinc-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="h-1 bg-green-500 w-full animate-pulse" />
        <div className="flex items-center gap-3 p-4">
          <Avatar className="w-12 h-12 shrink-0">
            <AvatarImage src={call.caller?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold">
              {name.replace("@", "").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{name}</p>
            <p className="text-white/60 text-xs flex items-center gap-1">
              {call.type === "video"
                ? <><Video className="w-3 h-3" /> Appel vidéo entrant</>
                : <><Phone className="w-3 h-3" /> Appel audio entrant</>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={reject} className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors">
              <PhoneOff className="w-4 h-4 text-white" />
            </button>
            <button onClick={accept} className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors animate-pulse">
              <Phone className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
