"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Plus, Search, Hash, Crown, Shield, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  myMemberships: any[]
  publicCommunities: any[]
  currentUserId: string
}

export default function CommunitiesClient({ myMemberships, publicCommunities, currentUserId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<"mes" | "decouvrir">("mes")
  const [query, setQuery] = useState("")
  const [joining, setJoining] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", is_public: true })

  const joinCommunity = async (communityId: string) => {
    setJoining(communityId)
    await supabase.from("community_members").insert({
      community_id: communityId,
      user_id: currentUserId,
      role: "member",
    })
    setJoining(null)
    router.refresh()
  }

  const createCommunity = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    const base = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 20)
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`

    const { data: community, error } = await supabase
      .from("communities")
      .insert({
        name: form.name.trim(),
        slug,
        description: form.description || null,
        is_public: form.is_public,
        created_by: currentUserId,
      })
      .select("id")
      .single()

    if (error || !community) { setCreating(false); return }

    await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: currentUserId,
      role: "owner",
    })

    setCreating(false)
    setShowCreate(false)
    setForm({ name: "", description: "", is_public: true })
    router.push(`/communities/${community.id}`)
  }

  const filtered = myMemberships.filter(m => {
    const c = m.community as any
    if (!c) return false
    return !query || c.name?.toLowerCase().includes(query.toLowerCase())
  })

  const ROLE_ICON: Record<string, any> = {
    owner: Crown, admin: Shield, moderator: Shield, member: Users,
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Communautés</h1>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Créer
          </Button>
        </div>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {([["mes", "Mes groupes"], ["decouvrir", "Découvrir"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors",
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "mes" && (
          <div className="p-4 space-y-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher…" className="pl-8 h-8 text-sm bg-muted/50 border-transparent" />
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                <Users className="w-10 h-10 opacity-20" />
                <p className="text-sm">Aucune communauté</p>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>Créer la première</Button>
              </div>
            ) : (
              filtered.map((membership) => {
                const community = membership.community as any
                if (!community) return null
                const RoleIcon = ROLE_ICON[membership.role] ?? Users
                return (
                  <Link key={community.id} href={`/communities/${community.id}`}
                    className="block bg-muted/30 rounded-xl p-3 hover:bg-muted/60 active:bg-muted/80 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-11 h-11 rounded-xl shrink-0">
                        <AvatarImage src={community.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold rounded-xl">
                          {community.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{community.name}</p>
                          <RoleIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                        {community.description && (
                          <p className="text-xs text-muted-foreground truncate">{community.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />{community.member_count ?? 0} membres
                          </span>
                          {community.groups?.length > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" />{community.groups.length} canaux
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {community.groups?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                        {community.groups.slice(0, 4).map((group: any) => (
                          <span key={group.id} className="text-[11px] bg-background px-2 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" />{group.name}
                          </span>
                        ))}
                        {community.groups.length > 4 && (
                          <span className="text-[11px] text-muted-foreground px-2">+{community.groups.length - 4}</span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })
            )}
          </div>
        )}

        {tab === "decouvrir" && (
          <div className="p-4 space-y-2">
            {publicCommunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <Search className="w-10 h-10 opacity-20" />
                <p className="text-sm">Aucune communauté publique</p>
              </div>
            ) : (
              publicCommunities.map((community) => (
                <Link key={community.id} href={`/communities/${community.id}`}
                  className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 hover:bg-muted/60 transition-colors">
                  <Avatar className="w-11 h-11 rounded-xl shrink-0">
                    <AvatarImage src={community.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold rounded-xl">
                      {community.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{community.name}</p>
                    {community.description && (
                      <p className="text-xs text-muted-foreground truncate">{community.description}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />{community.member_count ?? 0} membres
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs"
                    disabled={joining === community.id}
                    onClick={e => { e.preventDefault(); joinCommunity(community.id) }}>
                    {joining === community.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Rejoindre"}
                  </Button>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Nouvelle communauté</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ma communauté" maxLength={50} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optionnel…" maxLength={200} />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Communauté publique</p>
                  <p className="text-xs text-muted-foreground">Visible par tous</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
                  className={cn("w-10 h-6 rounded-full transition-colors relative", form.is_public ? "bg-primary" : "bg-muted")}>
                  <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    form.is_public ? "translate-x-5" : "translate-x-1")} />
                </button>
              </div>
              <Button onClick={createCommunity} disabled={creating || !form.name.trim()} className="w-full gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Création…" : "Créer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
