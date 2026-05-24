#!/bin/bash
# ============================================================
# NEXUS — Étape 9 : Stories (24h comme WhatsApp/Instagram)
# ============================================================
echo "🚀 Création des Stories..."

mkdir -p src/app/\(app\)/stories
mkdir -p src/components/stories

# ============================================================
# 1. Page Stories — Server Component
# ============================================================
cat > src/app/\(app\)/stories/page.tsx << 'EOF'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import StoriesClient from "@/components/stories/StoriesClient"

export default async function StoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Charger les stories non expirées groupées par user
  const { data: stories } = await supabase
    .from("stories")
    .select(`
      id, media_url, media_type, thumbnail_url, caption,
      duration, view_count, expires_at, created_at,
      user:profiles ( id, username, display_name, avatar_url ),
      views:story_views ( viewer_id )
    `)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  // Mon profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .single()

  // Mes stories
  const { data: myStories } = await supabase
    .from("stories")
    .select("id, media_url, media_type, thumbnail_url, caption, duration, view_count, expires_at, created_at, views:story_views(viewer_id)")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  return (
    <StoriesClient
      stories={stories ?? []}
      myStories={myStories ?? []}
      profile={profile}
      currentUserId={user.id}
    />
  )
}
EOF
echo "✓ stories/page.tsx"

# ============================================================
# 2. StoriesClient — liste + viewer + upload
# ============================================================
cat > src/components/stories/StoriesClient.tsx << 'EOF'
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Plus, X, ChevronLeft, ChevronRight, Eye, Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface StoriesClientProps {
  stories: any[]
  myStories: any[]
  profile: any
  currentUserId: string
}

// Grouper les stories par utilisateur
function groupByUser(stories: any[]) {
  const map = new Map<string, { user: any; stories: any[] }>()
  for (const story of stories) {
    const uid = story.user?.id
    if (!uid) continue
    if (!map.has(uid)) map.set(uid, { user: story.user, stories: [] })
    map.get(uid)!.stories.push(story)
  }
  return Array.from(map.values())
}

export default function StoriesClient({ stories, myStories, profile, currentUserId }: StoriesClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [viewer, setViewer] = useState<{ groups: any[]; groupIdx: number; storyIdx: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [caption, setCaption] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const otherGroups = groupByUser(stories.filter(s => s.user?.id !== currentUserId))

  // Ouvrir le viewer
  const openViewer = (groups: any[], groupIdx: number, storyIdx = 0) => {
    setViewer({ groups, groupIdx, storyIdx })
  }

  // Navigation dans le viewer
  const nextStory = async () => {
    if (!viewer) return
    const group = viewer.groups[viewer.groupIdx]
    const story = group.stories[viewer.storyIdx]

    // Marquer comme vu
    await supabase.from("story_views").upsert({
      story_id: story.id, viewer_id: currentUserId
    }, { onConflict: "story_id,viewer_id" })

    if (viewer.storyIdx < group.stories.length - 1) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx + 1 })
    } else if (viewer.groupIdx < viewer.groups.length - 1) {
      setViewer({ ...viewer, groupIdx: viewer.groupIdx + 1, storyIdx: 0 })
    } else {
      setViewer(null)
    }
  }

  const prevStory = () => {
    if (!viewer) return
    if (viewer.storyIdx > 0) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx - 1 })
    } else if (viewer.groupIdx > 0) {
      const prevGroup = viewer.groups[viewer.groupIdx - 1]
      setViewer({ ...viewer, groupIdx: viewer.groupIdx - 1, storyIdx: prevGroup.stories.length - 1 })
    } else {
      setViewer(null)
    }
  }

  // Upload story
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setShowUpload(true)
  }

  const uploadStory = async () => {
    if (!selectedFile) return
    setUploading(true)

    const ext = selectedFile.name.split(".").pop()
    const path = `${currentUserId}/${Date.now()}.${ext}`
    const isVideo = selectedFile.type.startsWith("video/")

    const { error: uploadError } = await supabase.storage
      .from("stories")
      .upload(path, selectedFile, { upsert: true })

    if (uploadError) { setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(path)

    await supabase.from("stories").insert({
      user_id: currentUserId,
      media_url: publicUrl,
      media_type: isVideo ? "video" : "image",
      caption: caption || null,
      duration: isVideo ? 15 : 5,
    })

    setUploading(false)
    setShowUpload(false)
    setPreviewUrl(null)
    setSelectedFile(null)
    setCaption("")
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold mb-4">Stories</h1>

        {/* Ma story + autres */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Ajouter ma story */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <label className="cursor-pointer">
              <div className="relative w-16 h-16">
                <Avatar className="w-16 h-16 border-2 border-dashed border-primary/40">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {(profile?.display_name ?? profile?.username ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <input type="file" accept="image/*,video/mp4" className="hidden" onChange={handleFileSelect} />
            </label>
            <span className="text-[10px] text-muted-foreground">
              {myStories.length > 0 ? "Ma story" : "Ajouter"}
            </span>
          </div>

          {/* Mes stories existantes */}
          {myStories.length > 0 && (
            <div
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
              onClick={() => openViewer([{ user: profile, stories: myStories }], 0)}
            >
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-primary to-purple-500">
                <Avatar className="w-full h-full border-2 border-background">
                  {myStories[0].media_type === "image"
                    ? <AvatarImage src={myStories[0].media_url} className="object-cover" />
                    : <AvatarFallback className="bg-primary/20">📹</AvatarFallback>
                  }
                </Avatar>
              </div>
              <span className="text-[10px] text-muted-foreground">Mes stories</span>
            </div>
          )}

          {/* Stories des autres */}
          {otherGroups.map((group, gi) => {
            const hasUnseen = group.stories.some(
              (s: any) => !s.views?.some((v: any) => v.viewer_id === currentUserId)
            )
            return (
              <div
                key={group.user.id}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                onClick={() => openViewer(otherGroups, gi)}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full p-0.5",
                  hasUnseen
                    ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
                    : "bg-muted"
                )}>
                  <Avatar className="w-full h-full border-2 border-background">
                    <AvatarImage src={group.user.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {(group.user.display_name ?? group.user.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-[10px] text-muted-foreground max-w-[64px] truncate text-center">
                  {group.user.display_name ?? `@${group.user.username}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste stories récentes */}
      <div className="flex-1 overflow-y-auto px-4 py-2 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Récentes</p>
        {otherGroups.length === 0 && myStories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <p className="text-sm">Aucune story pour l'instant</p>
            <p className="text-xs">Sois le premier à en partager une !</p>
          </div>
        )}
        {otherGroups.map((group, gi) => {
          const latest = group.stories[0]
          const hasUnseen = group.stories.some(
            (s: any) => !s.views?.some((v: any) => v.viewer_id === currentUserId)
          )
          const totalViews = group.stories.reduce((acc: number, s: any) => acc + (s.view_count ?? 0), 0)
          return (
            <div
              key={group.user.id}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/30 rounded-xl px-2 transition-colors"
              onClick={() => openViewer(otherGroups, gi)}
            >
              <div className={cn(
                "w-12 h-12 rounded-full p-0.5 shrink-0",
                hasUnseen ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" : "bg-muted"
              )}>
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={group.user.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {(group.user.display_name ?? group.user.username ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate", hasUnseen ? "font-semibold" : "font-medium")}>
                  {group.user.display_name ?? `@${group.user.username}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: fr })}
                  {" · "}{group.stories.length} story{group.stories.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Eye className="w-3 h-3" />
                {totalViews}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── VIEWER ─────────────────────────────────────── */}
      {viewer && (() => {
        const group = viewer.groups[viewer.groupIdx]
        const story = group.stories[viewer.storyIdx]
        const total = group.stories.length
        const viewed = story.views?.some((v: any) => v.viewer_id === currentUserId)

        return (
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            {/* Progress bars */}
            <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
              {group.stories.map((_: any, i: number) => (
                <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-white rounded-full", i < viewer.storyIdx ? "w-full" : i === viewer.storyIdx ? "w-full animate-[grow_5s_linear]" : "w-0")} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8 border border-white/40">
                  <AvatarImage src={group.user.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-white/20 text-white">
                    {(group.user.display_name ?? group.user.username ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white text-xs font-semibold">
                    {group.user.display_name ?? `@${group.user.username}`}
                  </p>
                  <p className="text-white/60 text-[10px]">
                    {formatDistanceToNow(new Date(story.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewer(null)} className="text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media */}
            <div className="w-full h-full flex items-center justify-center">
              {story.media_type === "image"
                ? <img src={story.media_url} className="max-w-full max-h-full object-contain" alt="" />
                : <video src={story.media_url} className="max-w-full max-h-full" autoPlay muted loop />
              }
            </div>

            {/* Caption */}
            {story.caption && (
              <div className="absolute bottom-20 left-4 right-4 z-10">
                <p className="text-white text-sm text-center bg-black/40 px-3 py-2 rounded-xl backdrop-blur-sm">
                  {story.caption}
                </p>
              </div>
            )}

            {/* Navigation */}
            <button onClick={prevStory} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 text-white/70 hover:text-white">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={nextStory} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 text-white/70 hover:text-white">
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Vues (si c'est ma story) */}
            {story.user?.id === currentUserId && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-xs">
                  <Eye className="w-3.5 h-3.5" />
                  {story.view_count ?? 0} vue{(story.view_count ?? 0) > 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── UPLOAD MODAL ───────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Nouvelle story</h3>
              <button onClick={() => { setShowUpload(false); setPreviewUrl(null) }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {previewUrl && (
              <div className="relative aspect-[9/16] bg-black max-h-72 overflow-hidden">
                {selectedFile?.type.startsWith("video/")
                  ? <video src={previewUrl} className="w-full h-full object-cover" autoPlay muted loop />
                  : <img src={previewUrl} className="w-full h-full object-cover" alt="" />
                }
              </div>
            )}

            <div className="p-4 space-y-3">
              <input
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Ajouter une légende… (optionnel)"
                className="w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50"
                maxLength={200}
              />
              <Button onClick={uploadStory} disabled={uploading || !selectedFile} className="w-full gap-2">
                {uploading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />
                }
                {uploading ? "Publication…" : "Publier la story"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
EOF
echo "✓ StoriesClient.tsx"

echo ""
echo "✅ Stories créées !"
echo ""
echo "👉 Lance : rm -rf .next && pnpm dev"
echo "   Puis va sur : http://localhost:3000/stories"
