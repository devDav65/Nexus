"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Users, Plus, Hash, ChevronRight, Globe,
    Lock, X, Loader2, Search
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
    myMemberships: any[]
    publicCommunities: any[]
    currentUserId: string
}

export default function CommunitiesClient({ myMemberships, publicCommunities, currentUserId }: Props) {
    const supabase = createClient()
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
    const [query, setQuery] = useState("")

    // Formulaire création
    const [form, setForm] = useState({ name: "", description: "", isPublic: true })
    const [creating, setCreating] = useState(false)

    const handleCreate = async () => {
        if (!form.name.trim()) return
        setCreating(true)

        const slug = form.name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "")
            + "-" + Date.now().toString(36)

        const { data: community, error } = await supabase
            .from("communities")
            .insert({
                name: form.name.trim(),
                slug,
                description: form.description.trim() || null,
                is_public: form.isPublic,
                created_by: currentUserId,
                member_count: 1,
            })
            .select("id")
            .single()

        if (!error && community) {
            await supabase.from("community_members").insert({
                community_id: community.id,
                user_id: currentUserId,
                role: "owner",
            })

            // Créer un canal général par défaut
            await supabase.from("groups").insert({
                community_id: community.id,
                name: "Général",
                slug: "general",
                description: "Canal général",
                is_public: true,
                created_by: currentUserId,
                member_count: 1,
            })
        }

        setCreating(false)
        setShowCreate(false)
        setForm({ name: "", description: "", isPublic: true })
        router.refresh()
    }

    const handleJoin = async (communityId: string) => {
        await supabase.from("community_members").insert({
            community_id: communityId,
            user_id: currentUserId,
            role: "member",
        })
        await supabase
            .from("communities")
            .update({ member_count: supabase.rpc("increment", { x: 1 }) as any })
            .eq("id", communityId)
        router.refresh()
    }

    const filtered = myMemberships.filter(m => {
        const c = m.community as any
        return !query || c?.name?.toLowerCase().includes(query.toLowerCase())
    })

    return (
        <div className="flex h-full">
            {/* ── Sidebar communautés ── */}
            <div className="w-full md:w-72 flex flex-col border-r border-border shrink-0">
                <div className="shrink-0 px-4 pt-4 pb-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-semibold">Communautés</h1>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 rounded-full"
                            onClick={() => setShowCreate(true)}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Rechercher…"
                            className="pl-8 h-9 bg-muted/50 border-transparent text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Mes communautés */}
                    {filtered.length > 0 && (
                        <div className="px-2 py-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                                Mes communautés
                            </p>
                            {filtered.map((m) => {
                                const c = m.community as any
                                if (!c) return null
                                const isSelected = selectedCommunity?.id === c.id
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCommunity(c)}
                                        className={cn(
                                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors text-left",
                                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                        )}
                                    >
                                        <Avatar className="w-9 h-9 shrink-0">
                                            <AvatarImage src={c.avatar_url ?? undefined} />
                                            <AvatarFallback className={cn(
                                                "text-xs font-bold",
                                                isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                            )}>
                                                {c.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {c.groups?.length ?? 0} canal{(c.groups?.length ?? 0) > 1 ? "x" : ""}
                                                {" · "}{c.member_count} membre{c.member_count > 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        {m.role === "owner" && (
                                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                        Owner
                      </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Découverte */}
                    {publicCommunities.length > 0 && (
                        <div className="px-2 py-1 mt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                                Découvrir
                            </p>
                            {publicCommunities.map((c) => (
                                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                                    <Avatar className="w-9 h-9 shrink-0">
                                        <AvatarImage src={c.avatar_url ?? undefined} />
                                        <AvatarFallback className="text-xs font-bold bg-muted">
                                            {c.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{c.member_count} membres</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                                            onClick={() => handleJoin(c.id)}>
                                        Rejoindre
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {myMemberships.length === 0 && publicCommunities.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground px-6 text-center">
                            <Users className="w-8 h-8 opacity-30" />
                            <p className="text-sm">Aucune communauté</p>
                            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                                Créer une communauté
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Zone principale — canaux ── */}
            <div className={cn("flex-1 flex-col", selectedCommunity ? "flex" : "hidden md:flex")}>
                {selectedCommunity ? (
                    <CommunityView
                        community={selectedCommunity}
                        currentUserId={currentUserId}
                        onBack={() => setSelectedCommunity(null)}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <Users className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Sélectionne une communauté</p>
                    </div>
                )}
            </div>

            {/* ── Modal création ── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold">Créer une communauté</h2>
                            <button onClick={() => setShowCreate(false)}>
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Nom *</label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ma communauté"
                                    className="mt-1"
                                    maxLength={50}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="À propos de cette communauté…"
                                    className="mt-1 w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50 resize-none"
                                    rows={3}
                                    maxLength={200}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setForm({ ...form, isPublic: !form.isPublic })}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors",
                                        form.isPublic
                                            ? "border-primary/50 bg-primary/10 text-primary"
                                            : "border-border bg-muted/30 text-muted-foreground"
                                    )}
                                >
                                    {form.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                    {form.isPublic ? "Publique" : "Privée"}
                                </button>
                                <p className="text-xs text-muted-foreground">
                                    {form.isPublic ? "Visible par tous" : "Sur invitation uniquement"}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                                Annuler
                            </Button>
                            <Button
                                className="flex-1 gap-2"
                                onClick={handleCreate}
                                disabled={!form.name.trim() || creating}
                            >
                                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Créer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Sous-composant vue d'une communauté ─────────────────────
function CommunityView({
                           community,
                           currentUserId,
                           onBack,
                       }: {
    community: any
    currentUserId: string
    onBack: () => void
}) {
    const supabase = createClient()
    const router = useRouter()
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
    const [showAddChannel, setShowAddChannel] = useState(false)
    const [channelName, setChannelName] = useState("")

    const handleCreateChannel = async () => {
        if (!channelName.trim()) return
        const slug = channelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        await supabase.from("groups").insert({
            community_id: community.id,
            name: channelName.trim(),
            slug: `${slug}-${Date.now().toString(36)}`,
            is_public: true,
            created_by: currentUserId,
        })
        setChannelName("")
        setShowAddChannel(false)
        router.refresh()
    }

    return (
        <div className="flex h-full">
            {/* Sidebar canaux */}
            <div className="w-52 flex flex-col border-r border-border bg-muted/10 shrink-0">
                {/* Header communauté */}
                <div className="px-3 py-3 border-b border-border">
                    <button onClick={onBack} className="md:hidden text-muted-foreground mb-2">
                        ← Retour
                    </button>
                    <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                            <AvatarImage src={community.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {community.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-semibold truncate">{community.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {community.member_count} membre{community.member_count > 1 ? "s" : ""}
                    </p>
                </div>

                {/* Liste canaux */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    <div className="flex items-center justify-between px-1 mb-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Canaux
                        </p>
                        {community.created_by === currentUserId && (
                            <button
                                onClick={() => setShowAddChannel(!showAddChannel)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {showAddChannel && (
                        <div className="mb-2 flex gap-1">
                            <Input
                                value={channelName}
                                onChange={e => setChannelName(e.target.value)}
                                placeholder="nouveau-canal"
                                className="h-7 text-xs"
                                onKeyDown={e => e.key === "Enter" && handleCreateChannel()}
                                autoFocus
                            />
                            <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleCreateChannel}>
                                <Plus className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {(community.groups ?? []).map((group: any) => (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className={cn(
                                "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors",
                                selectedGroup?.id === group.id
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <Hash className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{group.name}</span>
                        </button>
                    ))}

                    {(!community.groups || community.groups.length === 0) && (
                        <p className="text-xs text-muted-foreground px-2 py-2">Aucun canal</p>
                    )}
                </div>
            </div>

            {/* Zone message du canal */}
            <div className="flex-1 flex flex-col">
                {selectedGroup ? (
                    <GroupChannelView
                        group={selectedGroup}
                        community={community}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Hash className="w-10 h-10 opacity-20" />
                        <p className="text-sm">Sélectionne un canal</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Vue d'un canal (messages) ────────────────────────────────
function GroupChannelView({
                              group,
                              community,
                              currentUserId,
                          }: {
    group: any
    community: any
    currentUserId: string
}) {
    const supabase = createClient()
    const [messages, setMessages] = useState<any[]>([])
    const [text, setText] = useState("")
    const [sending, setSending] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    // Utiliser la conversation liée au groupe (ou en créer une)
    const [convId, setConvId] = useState<string | null>(null)

    useEffect(() => {
        // Chercher ou créer une conversation de groupe pour ce canal
        const init = async () => {
            let { data: conv } = await supabase
                .from("conversations")
                .select("id")
                .eq("name", `${community.id}:${group.id}`)
                .eq("type", "group")
                .single()

            if (!conv) {
                const { data: newConv } = await supabase
                    .from("conversations")
                    .insert({
                        type: "group",
                        name: `${community.id}:${group.id}`,
                        created_by: currentUserId,
                    })
                    .select("id")
                    .single()
                conv = newConv

                if (newConv) {
                    await supabase.from("conversation_members").insert({
                        conversation_id: newConv.id,
                        user_id: currentUserId,
                        role: "admin",
                    })
                }
            }

            if (conv) {
                setConvId(conv.id)
                // Charger les messages
                const { data: msgs } = await supabase
                    .from("messages")
                    .select(`
            id, content, created_at, sender_id, type,
            sender:profiles(id, username, display_name, avatar_url)
          `)
                    .eq("conversation_id", conv.id)
                    .eq("is_deleted", false)
                    .order("created_at", { ascending: true })
                    .limit(50)
                setMessages(msgs ?? [])
            }
        }
        init()
    }, [group.id])

    useEffect(() => {
        if (!convId) return
        const channel = supabase
            .channel(`group:${convId}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: `conversation_id=eq.${convId}`,
            }, async (payload) => {
                const { data } = await supabase
                    .from("messages")
                    .select(`id, content, created_at, sender_id, type, sender:profiles(id, username, display_name, avatar_url)`)
                    .eq("id", payload.new.id)
                    .single()
                if (data) setMessages(prev => [...prev, data])
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [convId])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages.length])

    const sendMessage = async () => {
        if (!text.trim() || !convId || sending) return
        setSending(true)
        const content = text.trim()
        setText("")

        // S'assurer d'être membre
        await supabase.from("conversation_members").upsert({
            conversation_id: convId,
            user_id: currentUserId,
            role: "member",
        }, { onConflict: "conversation_id,user_id" })

        await supabase.from("messages").insert({
            conversation_id: convId,
            sender_id: currentUserId,
            content,
            type: "text",
            status: "sent",
        })
        setSending(false)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header canal */}
            <div className="shrink-0 flex items-center gap-2 px-4 h-12 border-b border-border">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm">{group.name}</p>
                {group.description && (
                    <p className="text-xs text-muted-foreground border-l border-border pl-2 truncate">
                        {group.description}
                    </p>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <Hash className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Début de #{group.name}</p>
                        <p className="text-xs">Soyez le premier à écrire !</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    const prev = messages[i - 1]
                    const isOwn = msg.sender_id === currentUserId
                    const showHeader = !prev || prev.sender_id !== msg.sender_id
                    return (
                        <div key={msg.id} className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
                            {!isOwn && (
                                <div className="w-7 shrink-0 mt-1">
                                    {showHeader && (
                                        <Avatar className="w-7 h-7">
                                            <AvatarImage src={msg.sender?.avatar_url ?? undefined} />
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                {(msg.sender?.display_name ?? msg.sender?.username ?? "?").charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            )}
                            <div className={cn("flex flex-col max-w-[70%]", isOwn ? "items-end" : "items-start")}>
                                {showHeader && !isOwn && (
                                    <p className="text-[11px] text-muted-foreground mb-0.5">
                                        {msg.sender?.display_name ?? `@${msg.sender?.username}`}
                                    </p>
                                )}
                                <div className={cn(
                                    "px-3 py-2 rounded-2xl text-sm break-words",
                                    isOwn
                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                        : "bg-muted text-foreground rounded-bl-none"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border px-3 py-2">
                <div className="flex items-end gap-2">
          <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={`Message #${group.name}`}
              rows={1}
              className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm bg-muted/50 border border-transparent focus:outline-none focus:border-border max-h-[120px] placeholder:text-muted-foreground"
          />
                    <Button
                        size="icon"
                        onClick={sendMessage}
                        disabled={!text.trim() || sending}
                        className="w-9 h-9 rounded-full mb-0.5"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
