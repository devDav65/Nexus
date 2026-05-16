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

  const membership = (community.members as any[])?.find(
    (m: any) => m.profile?.id === user.id
  )

  if (!community.is_public && !membership) notFound()

  // Messages de la communauté (canal principal)
  const { data: messages } = await supabase
    .from("messages")
    .select(`
      id, content, type, created_at, is_edited, sender_id,
      sender:profiles ( id, username, display_name, avatar_url )
    `)
    .eq("conversation_id", params.id) // on réutilise l'id communauté comme clé
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(50)

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <CommunityDetailClient
      community={community as any}
      currentUserId={user.id}
      currentUserProfile={profile}
      membership={membership ?? null}
      initialMessages={messages ?? []}
    />
  )
}
