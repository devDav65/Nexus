"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, CheckCheck, Pencil } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  message: any
  isOwn: boolean
  showAvatar: boolean
  isGrouped: boolean
}

function getSenderName(sender: any): string {
  if (!sender) return "Utilisateur"
  if (sender.display_name) return sender.display_name
  if (sender.username) return `@${sender.username}`
  return "Utilisateur"
}

function getSenderInitial(sender: any): string {
  return getSenderName(sender).replace("@", "").charAt(0).toUpperCase()
}

export default function MessageBubble({
                                        message,
                                        isOwn,
                                        showAvatar,
                                        isGrouped,
                                      }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), "HH:mm", { locale: fr })

  const reactionGroups = (message.reactions ?? []).reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
        return acc
      },
      {}
  )

  return (
      <div
          className={cn(
              "flex items-end gap-2",
              // ← CLEF : isOwn inverse la direction
              isOwn ? "flex-row-reverse" : "flex-row",
              isGrouped ? "mt-0.5" : "mt-3"
          )}
      >
        {/* Avatar — affiché uniquement pour les messages reçus */}
        {!isOwn && (
            <div className="w-7 shrink-0 self-end">
              {showAvatar ? (
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={message.sender?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {getSenderInitial(message.sender)}
                    </AvatarFallback>
                  </Avatar>
              ) : (
                  // Espace réservé pour aligner les bulles groupées
                  <div className="w-7" />
              )}
            </div>
        )}

        {/* Contenu */}
        <div
            className={cn(
                "flex flex-col max-w-[72%]",
                isOwn ? "items-end" : "items-start"
            )}
        >
          {/* Nom de l'expéditeur (groupe seulement) */}
          {!isOwn && showAvatar && (
              <p className="text-[11px] text-muted-foreground mb-1 ml-1">
                {getSenderName(message.sender)}
              </p>
          )}

          {/* Bulle */}
          <div
              className={cn(
                  "relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                  isOwn
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
              )}
          >
            {/* Message supprimé */}
            {message.is_deleted ? (
                <span className="italic opacity-60 text-xs">
              Message supprimé
            </span>
            ) : (
                message.content
            )}

            {/* Timestamp + statut */}
            <div
                className={cn(
                    "flex items-center gap-1 mt-0.5",
                    isOwn ? "justify-end" : "justify-start"
                )}
            >
              {message.is_edited && (
                  <Pencil className="w-2.5 h-2.5 opacity-40" />
              )}
              <span className="text-[10px] opacity-50">{time}</span>
              {isOwn && (
                  <span className="opacity-60">
                {message.status === "read" ? (
                    <CheckCheck className="w-3 h-3" />
                ) : (
                    <Check className="w-3 h-3" />
                )}
              </span>
              )}
            </div>
          </div>

          {/* Réactions */}
          {Object.keys(reactionGroups).length > 0 && (
              <div
                  className={cn(
                      "flex flex-wrap gap-1 mt-1",
                      isOwn ? "justify-end" : "justify-start"
                  )}
              >
                {Object.entries(reactionGroups).map(([emoji, count]) => (
                    <span
                        key={emoji}
                        className="bg-muted border border-border rounded-full px-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer hover:bg-accent"
                    >
                {emoji}
                      {(count as number) > 1 && (
                          <span className="text-muted-foreground">
                    {count as number}
                  </span>
                      )}
              </span>
                ))}
              </div>
          )}
        </div>
      </div>
  )
}