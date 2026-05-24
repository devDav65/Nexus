"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  initialConversations: any[]
  currentUserId: string
}

export default function MessagesListClient({ initialConversations, currentUserId }: Props) {
  const supabase = createClient()
  const [conversations, setConversations] = useState(() => {
    return [...initialConversations].sort((a, b) => {
      const aTime = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
      const bTime = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
      return bTime - aTime
    })
  })
  const [query, setQuery] = useState("")

  const refetch = async () => {
    const { data } = await supabase
      .from("conversation_members")
      .select(`
        last_read_at, is_muted,
        conversation:conversations (
          id, type, name, avatar_url, last_message_at, last_message_preview,
          members:conversation_members (
            user_id,
            profile:profiles ( id, username, display_name, avatar_url, status )
          )
        )
      `)
      .eq("user_id", currentUserId)
      .order("conversation(last_message_at)", { ascending: false })
      .limit(40)
    if (data) {
      // Trier par last_message_at décroissant côté client aussi
      const sorted = [...data].sort((a, b) => {
        const aTime = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
        const bTime = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
        return bTime - aTime
      })
      setConversations(sorted)
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel("messages-list")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        // Déclenché pour l'expéditeur ET le destinataire via le trigger SQL
        // Mise à jour optimiste — déplacer la conversation en tête immédiatement
        setConversations(prev => {
          const updated = prev.map(item => {
            if (item.conversation?.id === payload.new.id) {
              return {
                ...item,
                conversation: {
                  ...item.conversation,
                  last_message_at: payload.new.last_message_at,
                  last_message_preview: payload.new.last_message_preview,
                }
              }
            }
            return item
          })
          // Trier immédiatement
          return [...updated].sort((a, b) => {
            const aTime = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
            const bTime = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
            return bTime - aTime
          })
        })
        // Puis refetch complet pour avoir les données à jour
        setTimeout(refetch, 500)
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const convId = payload.new.conversation_id
        const now = payload.new.created_at ?? new Date().toISOString()
        const preview = payload.new.content ?? "📎 Fichier"

        // Mise à jour optimiste immédiate pour le RECEVEUR aussi
        setConversations(prev => {
          const exists = prev.some(item => item.conversation?.id === convId)
          if (!exists) {
            // Nouvelle conversation — refetch complet
            setTimeout(refetch, 300)
            return prev
          }
          const updated = prev.map(item => {
            if (item.conversation?.id === convId) {
              return {
                ...item,
                conversation: {
                  ...item.conversation,
                  last_message_at: now,
                  last_message_preview: preview,
                }
              }
            }
            return item
          })
          // Remonter immédiatement en tête
          return [...updated].sort((a, b) => {
            const aTime = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
            const bTime = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
            return bTime - aTime
          })
        })
        // Pas de refetch — le tri optimiste suffit
        // Le refetch se fait via l'UPDATE de conversations (trigger SQL)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const filtered = conversations.filter((item) => {
    const conv = item.conversation
    if (!conv) return false
    const search = query.toLowerCase()
    if (!search) return true
    if (conv.name?.toLowerCase().includes(search)) return true
    if (conv.last_message_preview?.toLowerCase().includes(search)) return true
    return conv.members?.some((m: any) =>
      m.profile?.display_name?.toLowerCase().includes(search) ||
      m.profile?.username?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Messages</h1>
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
            <Edit3 className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="pl-8 h-9 bg-muted/50 border-transparent focus:border-input text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {filtered.length === 0 && query ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">Aucun résultat pour « {query} »</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 text-muted-foreground px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <p className="text-sm">Aucune conversation pour l'instant</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/search">Trouver des contacts</Link>
            </Button>
          </div>
        ) : (
          filtered.map((item) => (
            <ConversationRow
              key={item.conversation?.id}
              item={item}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <Button asChild size="icon" className="w-12 h-12 rounded-full shadow-lg">
          <Link href="/search"><Edit3 className="w-5 h-5" /></Link>
        </Button>
      </div>
    </div>
  )
}

function ConversationRow({ item, currentUserId }: { item: any; currentUserId: string }) {
  const conv = item.conversation
  if (!conv) return null

  const isDM = conv.type === "direct"
  const otherMember = isDM
    ? conv.members?.find((m: any) => m.user_id !== currentUserId)
    : null

  const displayName = isDM
    ? otherMember?.profile?.display_name ?? (otherMember?.profile?.username ? `@${otherMember.profile.username}` : "Contact")
    : conv.name ?? "Groupe"

  const avatarUrl = isDM ? otherMember?.profile?.avatar_url : conv.avatar_url
  const isOnline = otherMember?.profile?.status === "online"
  const initials = displayName.replace("@", "").charAt(0).toUpperCase()

  const lastRead = new Date(item.last_read_at ?? 0)
  const lastMsg = conv.last_message_at ? new Date(conv.last_message_at) : null
  const hasUnread = !item.is_muted && lastMsg && lastMsg > lastRead

  // Nom de l'expéditeur du dernier message
  const lastSender = conv.members?.find((m: any) => {
    // On cherche qui a envoyé le dernier message via le preview
    return m.user_id === currentUserId
  })
  const isMyLastMessage = lastMsg && conv.last_message_preview &&
    conv.members?.some((m: any) => m.user_id === currentUserId && lastMsg <= new Date(item.last_read_at ?? 0))

  return (
    <Link
      href={`/messages/${conv.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="w-12 h-12">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isDM && isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className={cn("text-sm truncate", hasUnread ? "font-semibold text-foreground" : "font-medium")}>
            {displayName}
          </p>
          {lastMsg && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatDistanceToNow(lastMsg, { addSuffix: false, locale: fr })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-xs truncate", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
            {conv.last_message_preview
              ? <>
                  {/* Préfixe "Vous : " si c'est mon dernier message */}
                  {hasUnread
                    ? <span className="text-primary font-semibold">{otherMember?.profile?.display_name ?? otherMember?.profile?.username ?? "Contact"} : </span>
                    : <span className="text-muted-foreground">Vous : </span>
                  }
                  {conv.last_message_preview}
                </>
              : "Nouvelle conversation"
            }
          </p>
          {hasUnread && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
              N
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
