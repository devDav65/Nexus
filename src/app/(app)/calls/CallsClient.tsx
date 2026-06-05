"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Phone, Video, PhoneMissed, PhoneIncoming,
  PhoneOutgoing, PhoneOff, Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow, format } from "date-fns"
import { fr } from "date-fns/locale"
import CallScreen from "@/components/calls/CallScreen"

interface Props {
  calls: any[]
  contacts: any[]
  currentUserId: string
}

function getDuration(call: any): string {
  if (!call.started_at || !call.ended_at) return ""
  const secs = Math.floor(
    (new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000
  )
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}min ${secs % 60}s`
}

export default function CallsClient({ calls, contacts, currentUserId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [activeCall, setActiveCall] = useState<{
    callId: string; contact: any; callType: "audio" | "video"; isInitiator: boolean
  } | null>(null)

  const startCall = async (contact: any, type: "audio" | "video") => {
    const { data: call, error } = await supabase
      .from("calls")
      .insert({ caller_id: currentUserId, callee_id: contact.id, type, status: "ringing" })
      .select("id").single()

    if (!error && call) {
      setActiveCall({ callId: call.id, contact, callType: type, isInitiator: true })
    }
  }

  if (activeCall) {
    return (
      <CallScreen
        callId={activeCall.callId}
        contact={activeCall.contact}
        callType={activeCall.callType}
        currentUserId={currentUserId}
        isInitiator={activeCall.isInitiator}
        onEnd={() => { setActiveCall(null); router.refresh() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Appels</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contacts rapides */}
        {contacts.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Appeler rapidement
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {contacts.map((contact: any) => (
                <div key={contact.id} className="flex flex-col items-center gap-2 shrink-0">
                  <div className="relative">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={contact.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                        {(contact.display_name ?? contact.username ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {contact.status === "online" && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <p className="text-xs max-w-[56px] truncate text-center text-muted-foreground">
                    {contact.display_name ?? `@${contact.username}`}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => startCall(contact, "audio")}
                      className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center hover:bg-green-500/20 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startCall(contact, "video")}
                      className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                      <Video className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Récents
          </p>

          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
              <Phone className="w-10 h-10 opacity-20" />
              <p className="text-sm">Aucun appel pour l'instant</p>
            </div>
          ) : (
            calls.map((call) => {
              const isCaller = call.caller?.id === currentUserId
              const otherPerson = isCaller ? call.callee : call.caller
              const name = otherPerson?.display_name ?? `@${otherPerson?.username}` ?? "Contact"
              const duration = getDuration(call)

              // Icône selon le statut
              let Icon = Phone
              let iconColor = "text-muted-foreground"
              let statusLabel = ""

              if (call.status === "missed" || (call.status === "ended" && !call.started_at)) {
                Icon = PhoneMissed
                iconColor = "text-red-500"
                statusLabel = "Manqué"
              } else if (call.status === "rejected") {
                Icon = PhoneOff
                iconColor = "text-red-500"
                statusLabel = "Refusé"
              } else if (call.status === "ended" && call.started_at) {
                Icon = isCaller ? PhoneOutgoing : PhoneIncoming
                iconColor = "text-green-500"
                statusLabel = duration
              } else if (call.status === "active") {
                Icon = Phone
                iconColor = "text-green-500"
                statusLabel = "En cours"
              } else {
                Icon = isCaller ? PhoneOutgoing : PhoneIncoming
                iconColor = "text-muted-foreground"
                statusLabel = call.status
              }

              return (
                <div key={call.id} className="flex items-center gap-3 py-3 hover:bg-muted/20 rounded-xl px-2 -mx-2 transition-colors">
                  <Avatar className="w-11 h-11 shrink-0">
                    <AvatarImage src={otherPerson?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {name.replace("@", "").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Icon className={cn("w-3 h-3 shrink-0", iconColor)} />
                      <span className={iconColor}>{statusLabel}</span>
                      {call.type === "video" && <Video className="w-3 h-3 ml-1" />}
                      <span className="text-muted-foreground/60">·</span>
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>

                  {/* Rappeler */}
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => startCall(otherPerson, "audio")}
                      className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {call.type === "video" && (
                      <button
                        onClick={() => startCall(otherPerson, "video")}
                        className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
