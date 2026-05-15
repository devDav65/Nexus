"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Phone, Video, PhoneMissed, PhoneIncoming,
    PhoneOutgoing, Clock, Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
    callHistory: any[]
    recentContacts: any[]
    currentUserId: string
}

export default function CallsClient({ callHistory, recentContacts, currentUserId }: Props) {
    const router = useRouter()
    const [activeCall, setActiveCall] = useState<{
        type: "audio" | "video"
        contact: any
    } | null>(null)

    // Extraire contacts uniques des conversations DM
    const contacts = recentContacts
        .map(m => {
            const conv = m.conversation as any
            if (conv?.type !== "direct") return null
            const other = conv?.members?.find((mem: any) => mem.user_id !== currentUserId)
            return other?.profile ?? null
        })
        .filter(Boolean)
        .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)

    const startCall = (contact: any, type: "audio" | "video") => {
        setActiveCall({ type, contact })
    }

    if (activeCall) {
        return (
            <CallScreen
                contact={activeCall.contact}
                callType={activeCall.type}
                onEnd={() => setActiveCall(null)}
            />
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 px-4 pt-4 pb-2">
                <h1 className="text-lg font-semibold">Appels</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Contacts pour appeler */}
                {contacts.length > 0 && (
                    <div className="px-4 py-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Contacts récents
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {contacts.map((contact: any) => (
                                <div key={contact.id} className="flex flex-col items-center gap-2 shrink-0">
                                    <div className="relative">
                                        <Avatar className="w-14 h-14">
                                            <AvatarImage src={contact.avatar_url ?? undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                {(contact.display_name ?? contact.username ?? "?").charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {contact.status === "online" && (
                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                                        )}
                                    </div>
                                    <p className="text-xs text-center max-w-[56px] truncate">
                                        {contact.display_name ?? `@${contact.username}`}
                                    </p>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => startCall(contact, "audio")}
                                            className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center hover:bg-green-500/20 transition-colors"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => startCall(contact, "video")}
                                            className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Historique */}
                <div className="px-4 py-2 border-t border-border mt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Récents
                    </p>

                    {callHistory.length === 0 && contacts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                            <Phone className="w-10 h-10 opacity-20" />
                            <p className="text-sm">Aucun appel pour l'instant</p>
                            <p className="text-xs">Commence par envoyer un message</p>
                            <Button variant="outline" size="sm" onClick={() => router.push("/search")}>
                                Trouver des contacts
                            </Button>
                        </div>
                    )}

                    {callHistory.map((call) => {
                        const data = call.data as any
                        return (
                            <div key={call.id} className="flex items-center gap-3 py-3">
                                <Avatar className="w-10 h-10 shrink-0">
                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                        {call.title.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{call.title}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <PhoneMissed className="w-3 h-3 text-red-500" />
                                        <span>Appel manqué · {formatDistanceToNow(new Date(call.created_at), { locale: fr, addSuffix: true })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
                                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}


// ── Écran d'appel (UI WebRTC) ────────────────────────────────
function CallScreen({
                        contact,
                        callType,
                        onEnd,
                    }: {
    contact: any
    callType: "audio" | "video"
    onEnd: () => void
}) {
    const [muted, setMuted] = useState(false)
    const [cameraOff, setCameraOff] = useState(false)
    const [status, setStatus] = useState<"calling" | "connected">("calling")

    // Simuler connexion après 2s (remplacer par vraie logique WebRTC)
    useEffect(() => {
        const t = setTimeout(() => setStatus("connected"), 2000)
        return () => clearTimeout(t)
    }, [])

    return (
        <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col items-center justify-between py-16 px-6">
            {/* Infos contact */}
            <div className="flex flex-col items-center gap-4 mt-8">
                <Avatar className="w-24 h-24 border-4 border-white/10">
                    <AvatarImage src={contact.avatar_url ?? undefined} />
                    <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                        {(contact.display_name ?? contact.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="text-center">
                    <p className="text-white text-xl font-semibold">
                        {contact.display_name ?? `@${contact.username}`}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                        {status === "calling"
                            ? callType === "video" ? "Appel vidéo en cours…" : "Appel audio en cours…"
                            : "Connecté"
                        }
                    </p>
                    {status === "connected" && (
                        <p className="text-green-400 text-xs mt-1">● En ligne</p>
                    )}
                </div>
            </div>

            {/* Zone vidéo (placeholder) */}
            {callType === "video" && status === "connected" && (
                <div className="w-full max-w-sm aspect-video bg-zinc-800 rounded-2xl flex items-center justify-center my-4">
                    {cameraOff ? (
                        <div className="flex flex-col items-center gap-2 text-white/40">
                            <Video className="w-8 h-8" />
                            <p className="text-xs">Caméra désactivée</p>
                        </div>
                    ) : (
                        <p className="text-white/20 text-sm">Flux vidéo (WebRTC)</p>
                    )}
                </div>
            )}

            {/* Contrôles */}
            <div className="flex items-center gap-6">
                {/* Micro */}
                <button
                    onClick={() => setMuted(!muted)}
                    className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        muted ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                >
                    <Phone className={cn("w-6 h-6", muted && "line-through")} />
                </button>

                {/* Raccrocher */}
                <button
                    onClick={onEnd}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
                >
                    <Phone className="w-6 h-6 text-white rotate-[135deg]" />
                </button>

                {/* Caméra (vidéo uniquement) */}
                {callType === "video" && (
                    <button
                        onClick={() => setCameraOff(!cameraOff)}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                            cameraOff ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                    >
                        <Video className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    )
}
