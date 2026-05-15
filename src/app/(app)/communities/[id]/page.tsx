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
