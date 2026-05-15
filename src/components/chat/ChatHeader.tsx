"use client"

import Link from "next/link"
import { ArrowLeft, Phone, Video, Info } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

export default function ChatHeader({
  conversation,
  otherMember,
  currentUserId,
  onAudioCall,
  onVideoCall,
}: ChatHeaderProps) {
  const isDM = conversation.type === "direct"
  const profile = otherMember?.profile

  const displayName = isDM ? getProfileName(profile) : conversation.name ?? "Groupe"
  const avatarUrl = isDM ? profile?.avatar_url : conversation.avatar_url
  const isOnline = profile?.status === "online"
  const initial = displayName.replace("@", "").charAt(0).toUpperCase()

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-md">
      <Link href="/messages" className="md:hidden">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>

      <div className="relative">
        <Avatar className="w-9 h-9">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        {isDM && (
          <span className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
            isOnline ? "bg-green-500" : "bg-muted-foreground/40"
          )} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {isDM
            ? (isOnline ? "En ligne" : "Hors ligne")
            : `${conversation.members?.length ?? 0} membres`
          }
        </p>
      </div>

      <div className="flex items-center gap-1">
        {/* Appel audio */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={onAudioCall}
          disabled={!onAudioCall}
        >
          <Phone className="w-4 h-4" />
        </Button>

        {/* Appel vidéo */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={onVideoCall}
          disabled={!onVideoCall}
        >
          <Video className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
        >
          <Info className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
