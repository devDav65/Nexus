"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import MessageInput from "@/components/chat/MessageInput"
import MessageBubble from "@/components/chat/MessageBubble"
import {
  Users, Hash, Crown, Shield, LogOut, UserPlus,
  Trash2, ArrowLeft, Globe, Lock, Loader2,
  MessageSquare, Send, Search, X, Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow, format } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
  community: any
  currentUserId: string
  currentUserProfile: any
  membership: any | null
  initialMessages: any[]
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire", admin: "Admin",
  moderator: "Modérateur", member: "Membre",
}

export default function CommunityDetailClient({
  community, currentUserId, currentUserProfile, membership, initialMessages
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<"chat" | "membres" | "inviter">("chat")
  const [members, setMembers] = useState<any[]>(community.members ?? [])
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [newMsg, setNewMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [contactsLoaded, setContactsLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isOwner = membership?.role === "owner"
  const isAdmin = ["owner", "admin"].includes(membership?.role)
  const isMember = !!membership

  // Scroll bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Realtime messages communauté
  useEffect(() => {
    if (!isMember) return
    const channel = supabase
      .channel(`community-${community.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${community.id}`,
      }, async (payload) => {
        const msg = payload.new as any
        // Enrichir avec sender + attachments
        const { data: fullMsg } = await supabase
            .from("messages")
            .select(`
    id, content, type, status, created_at, is_edited, is_deleted, sender_id,
    metadata,
    sender:profiles ( id, username, display_name, avatar_url ),
    attachments ( id, url, file_name, file_size, mime_type, duration ),
    reactions ( id, emoji, user_id )
  `)
            .eq("id", payload.new.id)
            .single()

        if (fullMsg) {
          setMessages(prev => {
            if (prev.find(m => m.id === fullMsg.id)) return prev
            return [...prev, fullMsg]
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [community.id, isMember])

  // Envoyer message communauté
  const sendMessage = async () => {
    if (!newMsg.trim() || sending || !isMember) return
    setSending(true)

    // Créer la conversation si elle n'existe pas (id = community.id)
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", community.id)
      .single()

    if (!existingConv) {
      await supabase.from("conversations").insert({
        id: community.id,
        type: "group",
        name: community.name,
        created_by: currentUserId,
      })
    }

    await supabase.from("messages").insert({
      conversation_id: community.id,
      sender_id: currentUserId,
      content: newMsg.trim(),
      type: "text",
    })

    setNewMsg("")
    setSending(false)
  }

  // Rejoindre
  const join = async () => {
    setLoading("join")
    await supabase.from("community_members").insert({
      community_id: community.id, user_id: currentUserId, role: "member",
    })
    setLoading(null)
    router.refresh()
  }

  // Quitter
  const leave = async () => {
    if (isOwner) return
    setLoading("leave")
    await supabase.from("community_members")
      .delete().eq("community_id", community.id).eq("user_id", currentUserId)
    setLoading(null)
    router.push("/communities")
  }

  // Retirer un membre
  const removeMember = async (memberId: string, userId: string) => {
    if (!isAdmin || userId === currentUserId) return
    setLoading(memberId)
    await supabase.from("community_members").delete().eq("id", memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setLoading(null)
  }

  // Charger les contacts DM au montage
  useEffect(() => {
    if (!isAdmin || contactsLoaded) return
    const memberIds = members.map((m: any) => m.profile?.id).filter(Boolean)
    supabase
        .from("conversation_members")
        .select("user_id, profile:profiles!inner(id, username, display_name, avatar_url, status), conversation:conversations!inner(type)")
        .eq("conversations.type", "direct")
        .neq("user_id", currentUserId)
        .then(({ data }) => {
          const seen = new Set<string>()
          const unique = (data ?? []).filter((d: any) => {
            const pid = d.profile?.id
            if (!pid || seen.has(pid) || memberIds.includes(pid)) return false
            seen.add(pid); return true
          }).map((d: any) => d.profile)
          setContacts(unique)
          setContactsLoaded(true)
        })
  }, [isAdmin, contactsLoaded])

  // Chercher des users à inviter
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const memberIds = members.map(m => m.profile?.id).filter(Boolean)
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${searchQuery}%`)
      .not("id", "in", `(${memberIds.join(",")})`)
      .limit(10)
      .then(({ data }) => { setSearchResults(data ?? []); setSearching(false) })
  }, [searchQuery])

  // Inviter un membre
  const inviteMember = async (userId: string) => {
    setInviting(userId)
    const { data, error } = await supabase.from("community_members").insert({
      community_id: community.id, user_id: userId, role: "member",
    }).select(`id, role, joined_at, profile:profiles(id, username, display_name, avatar_url, status)`).single()

    if (!error && data) {
      setMembers(prev => [...prev, data])
      setSearchResults(prev => prev.filter(u => u.id !== userId))
    }
    setInviting(null)
  }

  const TABS = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "membres", label: `Membres (${members.length})`, icon: Users },
    ...(isAdmin ? [{ id: "inviter", label: "Inviter", icon: UserPlus }] : []),
  ] as const

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0">
        <div className="h-20 bg-gradient-to-br from-primary/30 to-purple-500/30 relative">
          {community.banner_url && <img src={community.banner_url} className="w-full h-full object-cover" alt="" />}
          <Link href="/communities" className="absolute top-3 left-3">
            <Button variant="ghost" size="icon" className="w-8 h-8 bg-black/30 text-white hover:bg-black/50 rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="px-4 pb-2 border-b border-border">
          <div className="flex items-end justify-between -mt-5 mb-2">
            <Avatar className="w-12 h-12 rounded-2xl border-4 border-background">
              <AvatarImage src={community.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg rounded-2xl">
                {community.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              {!isMember && community.is_public && (
                <Button size="sm" onClick={join} disabled={loading === "join"} className="gap-1.5 h-7 text-xs">
                  {loading === "join" ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                  Rejoindre
                </Button>
              )}
              {isMember && !isOwner && (
                <Button size="sm" variant="outline" onClick={leave} disabled={loading === "leave"}
                  className="gap-1.5 h-7 text-xs text-destructive border-destructive/30">
                  {loading === "leave" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                  Quitter
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold">{community.name}</h1>
            {community.is_public ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
            {membership && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {ROLE_LABELS[membership.role]}
              </span>
            )}
          </div>
          {community.description && <p className="text-xs text-muted-foreground mt-0.5">{community.description}</p>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={cn("flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors",
                tab === id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {tab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0">
          {!isMember ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 opacity-20 mx-auto mb-2" />
                <p className="text-sm">Rejoins la communauté pour voir le chat</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">Aucun message — soyez le premier !</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === currentUserId
                  const prevMsg = messages[i - 1]
                  const sameUser = prevMsg?.sender_id === msg.sender_id
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isMe}
                      showAvatar={!sameUser}
                      isGrouped={sameUser}
                    />
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input message — complet avec emoji, vocal, fichiers */}
              <MessageInput
                conversationId={community.id}
                currentUserId={currentUserId}
                onTyping={() => {}}
                onSend={async (text) => {
                  if (!isMember) return
                  // Créer la conversation si elle n existe pas
                  const { data: existingConv } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("id", community.id)
                    .single()
                  if (!existingConv) {
                    await supabase.from("conversations").insert({
                      id: community.id,
                      type: "group",
                      name: community.name,
                      created_by: currentUserId,
                    })
                  }
                  await supabase.from("messages").insert({
                    conversation_id: community.id,
                    sender_id: currentUserId,
                    content: text,
                    type: "text",
                  })
                }}
              />
            </>
          )}
        </div>
      )}

      {tab === "membres" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {members.map((member) => {
            const profile = member.profile
            const isMe = profile?.id === currentUserId
            const canRemove = isAdmin && !isMe && member.role !== "owner"
            const RoleIcon = member.role === "owner" ? Crown : member.role === "admin" ? Shield : Users
            return (
              <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="relative shrink-0">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {(profile?.display_name ?? profile?.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {profile?.status === "online" && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">
                      {profile?.display_name ?? `@${profile?.username}`}
                      {isMe && <span className="text-muted-foreground text-xs ml-1">(moi)</span>}
                    </p>
                    <RoleIcon className={cn("w-3 h-3 shrink-0", member.role === "owner" ? "text-yellow-500" : "text-muted-foreground")} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[member.role]} · {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {canRemove && (
                  <button onClick={() => removeMember(member.id, profile?.id)}
                    disabled={loading === member.id}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
                    {loading === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === "inviter" && isAdmin && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                     placeholder="Rechercher un @username…" className="pl-9" />
            </div>

            {/* Recherche active */}
            {searchQuery.length >= 2 && (
                <>
                  {searching && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                  {!searching && searchResults.map(user => <InviteRow key={user.id} user={user} inviting={inviting} onInvite={inviteMember} />)}
                  {!searching && searchResults.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Aucun résultat</p>}
                </>
            )}

            {/* Contacts par défaut */}
            {searchQuery.length < 2 && (
                <>
                  {!contactsLoaded && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                  {contactsLoaded && contacts.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <Users className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Aucun contact disponible</p>
                        <p className="text-xs">Utilise la barre de recherche ci-dessus</p>
                      </div>
                  )}
                  {contactsLoaded && contacts.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Contacts ({contacts.length})
                        </p>
                        {contacts.map(user => <InviteRow key={user.id} user={user} inviting={inviting} onInvite={inviteMember} />)}
                      </>
                  )}
                </>
            )}
          </div>
      )}
    </div>
  )
}
function InviteRow({ user, inviting, onInvite }: { user: any; inviting: string | null; onInvite: (id: string) => void }) {
  return (
      <div className="flex items-center gap-3 py-2.5 px-2 hover:bg-muted/30 rounded-xl transition-colors">
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {(user.display_name ?? user.username ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.status === "online" && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{user.display_name ?? user.username}</p>
          <p className="text-xs text-muted-foreground">@{user.username}</p>
        </div>
        <Button size="sm" onClick={() => onInvite(user.id)} disabled={inviting === user.id} className="gap-1.5 h-7 text-xs shrink-0">
          {inviting === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
          Ajouter
        </Button>
      </div>
  )
}
