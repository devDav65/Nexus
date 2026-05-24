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
