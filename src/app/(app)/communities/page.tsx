import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CommunitiesClient from "./CommunitiesClient"

export default async function CommunitiesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    // Communautés dont je suis membre
    const { data: myMemberships } = await supabase
        .from("community_members")
        .select(`
      role,
      community:communities (
        id, name, slug, description, avatar_url, banner_url,
        is_public, member_count, created_by, created_at,
        groups (
          id, name, slug, description, is_public, member_count
        )
      )
    `)
        .eq("user_id", user.id)

    // Communautés publiques (découverte)
    const { data: publicCommunities } = await supabase
        .from("communities")
        .select("id, name, slug, description, avatar_url, member_count")
        .eq("is_public", true)
        .not("id", "in", `(${(myMemberships ?? []).map(m => `'${(m.community as any)?.id}'`).join(",") || "''"})`)
        .limit(10)

    return (
        <CommunitiesClient
            myMemberships={myMemberships ?? []}
            publicCommunities={publicCommunities ?? []}
            currentUserId={user.id}
        />
    )
}
