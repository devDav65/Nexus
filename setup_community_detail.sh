#!/bin/bash
echo "🚀 Création page détail communauté..."

mkdir -p src/app/\(app\)/communities/\[id\]

# ============================================================
# 1. Page détail communauté
# ============================================================
cat > "src/app/(app)/communities/[id]/page.tsx" << 'EOF'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import CommunityDetailClient from "./CommunityDetailClient"

interface Props { params: { id: string } }

export default async function CommunityPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: community } = await supabase
    .from("communities")
    .select(`
      id, name, slug, description, avatar_url, banner_url,
      is_public, member_count, created_by, created_at,
      members:community_members (
        id, role, joined_at,
        profile:profiles ( id, username, display_name, avatar_url, status )
      ),
      groups ( id, name, slug, description, is_public, member_count )
    `)
    .eq("id", params.id)
    .single()

  if (!community) notFound()

  const membership = (community.members as any[])?.find(m => m.profile?.id === user.id)
  const isPublic = community.is_public
  if (!isPublic && !membership) notFound()

  return (
    <CommunityDetailClient
      community={community as any}
      currentUserId={user.id}
      membership={membership ?? null}
    />
  )
}
EOF
echo "✓ communities/[id]/page.tsx"

# ============================================================
# 2. CommunityDetailClient
# ============================================================
cat > "src/app/(app)/communities/[id]/CommunityDetailClient.tsx" << 'EOF'
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Hash, Crown, Shield, LogOut, UserPlus, Trash2, ArrowLeft, Globe, Lock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"

interface Props {
  community: any
  currentUserId: string
  membership: any | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  moderator: "Modérateur",
  member: "Membre",
}

const ROLE_ICONS: Record<string, any> = {
  owner: Crown,
  admin: Shield,
  moderator: Shield,
  member: Users,
}

export default function CommunityDetailClient({ community, currentUserId, membership }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<"membres" | "canaux">("membres")
  const [loading, setLoading] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>(community.members ?? [])

  const isOwner = membership?.role === "owner"
  const isAdmin = membership?.role === "admin" || isOwner
  const isMember = !!membership

  // Rejoindre
  const join = async () => {
    setLoading("join")
    await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: currentUserId,
      role: "member",
    })
    setLoading(null)
    router.refresh()
  }

  // Quitter
  const leave = async () => {
    if (isOwner) return
    setLoading("leave")
    await supabase.from("community_members")
      .delete()
      .eq("community_id", community.id)
      .eq("user_id", currentUserId)
    setLoading(null)
    router.push("/communities")
  }

  // Retirer un membre (admin/owner seulement)
  const removeMember = async (memberId: string, userId: string) => {
    if (!isAdmin || userId === currentUserId) return
    setLoading(memberId)
    await supabase.from("community_members")
      .delete()
      .eq("id", memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setLoading(null)
  }

  // Promouvoir admin
  const promoteToAdmin = async (memberId: string) => {
    if (!isOwner) return
    setLoading(memberId)
    await supabase.from("community_members")
      .update({ role: "admin" })
      .eq("id", memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: "admin" } : m))
    setLoading(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-br from-primary/30 to-purple-500/30 relative">
          {community.banner_url && (
            <img src={community.banner_url} className="w-full h-full object-cover" alt="" />
          )}
          <Link href="/communities" className="absolute top-3 left-3">
            <Button variant="ghost" size="icon" className="w-8 h-8 bg-black/30 text-white hover:bg-black/50 rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Infos */}
        <div className="px-4 pb-3 border-b border-border">
          <div className="flex items-end justify-between -mt-6 mb-2">
            <Avatar className="w-14 h-14 rounded-2xl border-4 border-background">
              <AvatarImage src={community.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl rounded-2xl">
                {community.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Actions */}
            <div className="flex gap-2">
              {!isMember && community.is_public && (
                <Button size="sm" onClick={join} disabled={loading === "join"} className="gap-1.5">
                  {loading === "join" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Rejoindre
                </Button>
              )}
              {isMember && !isOwner && (
                <Button size="sm" variant="outline" onClick={leave} disabled={loading === "leave"} className="gap-1.5 text-destructive border-destructive/30">
                  {loading === "leave" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  Quitter
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold">{community.name}</h1>
            {community.is_public
              ? <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              : <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            }
            {membership && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {ROLE_LABELS[membership.role] ?? "Membre"}
              </span>
            )}
          </div>

          {community.description && (
            <p className="text-xs text-muted-foreground mt-1">{community.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {members.length} membre{members.length > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {community.groups?.length ?? 0} canal{(community.groups?.length ?? 0) > 1 ? "ux" : ""}
            </span>
            <span>Créée {formatDistanceToNow(new Date(community.created_at), { addSuffix: true, locale: fr })}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["membres", "canaux"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "membres" ? `Membres (${members.length})` : `Canaux (${community.groups?.length ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto">
        {tab === "membres" && (
          <div className="p-3 space-y-1">
            {members.map((member) => {
              const profile = member.profile
              const RoleIcon = ROLE_ICONS[member.role] ?? Users
              const isMe = profile?.id === currentUserId
              const canRemove = isAdmin && !isMe && member.role !== "owner"
              const canPromote = isOwner && member.role === "member"

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
                      {ROLE_LABELS[member.role]} · rejoint {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>

                  {/* Actions admin */}
                  <div className="flex items-center gap-1 shrink-0">
                    {canPromote && (
                      <button
                        onClick={() => promoteToAdmin(member.id)}
                        disabled={loading === member.id}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors"
                        title="Promouvoir admin"
                      >
                        {loading === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => removeMember(member.id, profile?.id)}
                        disabled={loading === member.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Retirer"
                      >
                        {loading === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === "canaux" && (
          <div className="p-3 space-y-1">
            {(community.groups ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Hash className="w-8 h-8 opacity-20" />
                <p className="text-sm">Aucun canal</p>
              </div>
            ) : (
              (community.groups ?? []).map((group: any) => (
                <div key={group.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{group.name}</p>
                    {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    <Users className="w-3 h-3 inline mr-0.5" />{group.member_count ?? 0}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
EOF
echo "✓ communities/[id]/CommunityDetailClient.tsx"

# ============================================================
# 3. Rendre les communautés cliquables dans CommunitiesClient
# ============================================================
# Ajouter le lien vers la page détail sur chaque communauté
sed -i 's/className="bg-muted\/30 rounded-xl p-3 hover:bg-muted\/50 transition-colors cursor-pointer"/className="bg-muted\/30 rounded-xl p-3 hover:bg-muted\/50 transition-colors cursor-pointer"/' \
  src/app/\(app\)/communities/CommunitiesClient.tsx

echo ""
echo "✅ Page détail communauté créée !"
echo "👉 Lance : rm -rf .next && pnpm dev"
