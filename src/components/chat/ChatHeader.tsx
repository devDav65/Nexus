"use client"

import Link from "next/link"
import { ArrowLeft, Phone, Video, Info, X, Users, BellOff, Bell, Trash2, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface ChatHeaderProps {
  conversation: any
  otherMember: any
  currentUserId: string
  onAudioCall?: () => void
  onVideoCall?: () => void
}

function getProfileName(profile: any): string {
  if (!profile) return "Utilisateur"
  return profile.display_name ?? `@${profile.username}` ?? "Utilisateur"
}

export default function ChatHeader({ conversation, otherMember, currentUserId, onAudioCall, onVideoCall }: ChatHeaderProps) {
  const supabase = createClient()
  const router = useRouter()
  const [showInfo, setShowInfo] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [loadingMute, setLoadingMute] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isDM = conversation.type === "direct"
  const profile = otherMember?.profile
  const displayName = isDM ? getProfileName(profile) : conversation.name ?? "Groupe"
  const avatarUrl = isDM ? profile?.avatar_url : conversation.avatar_url
  const isOnline = profile?.status === "online"
  const initial = displayName.replace("@", "").charAt(0).toUpperCase()
  const members = conversation.members ?? []

  // ── Sourdine ─────────────────────────────────────────────
  const toggleMute = async () => {
    setLoadingMute(true)
    const newMuted = !isMuted
    const { error } = await supabase
      .from("conversation_members")
      .update({ is_muted: newMuted })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId)
    if (!error) setIsMuted(newMuted)
    setLoadingMute(false)
  }

  // ── Supprimer conversation ────────────────────────────────
  const deleteConversation = async () => {
    setLoadingDelete(true)
    // Supprimer les messages d'abord
    await supabase.from("messages").delete().eq("conversation_id", conversation.id)
    // Supprimer les membres
    await supabase.from("conversation_members").delete().eq("conversation_id", conversation.id)
    // Supprimer la conversation
    await supabase.from("conversations").delete().eq("id", conversation.id)
    setLoadingDelete(false)
    router.push("/messages")
    router.refresh()
  }

  return (
    <>
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-md">
        <Link href="/messages" className="md:hidden">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <button onClick={() => setShowInfo(true)} className="relative shrink-0">
          <Avatar className="w-9 h-9">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initial}</AvatarFallback>
          </Avatar>
          {isDM && (
            <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
              isOnline ? "bg-green-500" : "bg-muted-foreground/40")} />
          )}
        </button>

        <button onClick={() => setShowInfo(true)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {isDM ? (isOnline ? "En ligne" : "Hors ligne") : `${members.length} membres`}
          </p>
        </button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" onClick={onAudioCall} disabled={!onAudioCall}>
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" onClick={onVideoCall} disabled={!onVideoCall}>
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon"
            className={cn("w-8 h-8 rounded-full", showInfo ? "text-primary bg-primary/10" : "text-muted-foreground")}
            onClick={() => setShowInfo(p => !p)}>
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Panel Info */}
      {showInfo && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setShowInfo(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-xs h-full bg-background border-l border-border overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
              <h3 className="text-sm font-semibold">Informations</h3>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar + nom */}
            <div className="flex flex-col items-center py-6 px-4 border-b border-border">
              <Avatar className="w-20 h-20 mb-3">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initial}</AvatarFallback>
              </Avatar>
              <p className="font-semibold text-base">{displayName}</p>
              {isDM && profile?.username && <p className="text-xs text-muted-foreground mt-0.5">@{profile.username}</p>}
              {isDM && (
                <span className={cn("mt-2 text-xs px-2 py-0.5 rounded-full font-medium",
                  isOnline ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground")}>
                  {isOnline ? "En ligne" : "Hors ligne"}
                </span>
              )}
              {!isDM && <p className="text-xs text-muted-foreground mt-1">{members.length} membres</p>}
            </div>

            {/* Bio */}
            {isDM && profile?.bio && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Bio</p>
                <p className="text-sm">{profile.bio}</p>
              </div>
            )}

            {/* Membres groupe */}
            {!isDM && members.length > 0 && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Membres
                </p>
                <div className="space-y-2">
                  {members.map((m: any) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {(m.profile?.display_name ?? m.profile?.username ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium flex-1 truncate">
                        {m.profile?.display_name ?? `@${m.profile?.username}`}
                        {m.user_id === currentUserId && <span className="text-muted-foreground ml-1">(moi)</span>}
                      </p>
                      {m.role === "admin" && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Admin</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actions</p>

              {/* Sourdine */}
              <button
                onClick={toggleMute}
                disabled={loadingMute}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                {loadingMute
                  ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  : isMuted
                    ? <Bell className="w-4 h-4 text-primary" />
                    : <BellOff className="w-4 h-4 text-muted-foreground" />
                }
                <span className="text-sm">{isMuted ? "Réactiver les notifications" : "Mettre en sourdine"}</span>
              </button>

              {/* Supprimer */}
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors text-left text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Supprimer la conversation</span>
                </button>
              ) : (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-destructive font-medium">Supprimer définitivement tous les messages ?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={deleteConversation}
                      disabled={loadingDelete}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center justify-center gap-1"
                    >
                      {loadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Conversation créée {formatDistanceToNow(new Date(conversation.created_at ?? Date.now()), { addSuffix: true, locale: fr })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
