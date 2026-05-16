import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CommunitiesClient from "./CommunitiesClient"

export default async function CommunitiesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    // Mes communautés
    const { data: myMemberships } = await supabase
        .from("community_members")
        .select(`
      role,
      community:communities (
        id, name, slug, description, avatar_url,
        is_public, member_count, created_by, created_at,
        groups ( id, name, slug, description, is_public, member_count )
      )
    `)
        .eq("user_id", user.id)

    // IDs des communautés dont je suis membre
    const myIds = (myMemberships ?? [])
        .map(m => (m.community as any)?.id)
        .filter(Boolean)

    // Communautés publiques que je n'ai pas encore rejointes
    let publicQuery = supabase
        .from("communities")
        .select("id, name, slug, description, avatar_url, member_count")
        .eq("is_public", true)
        .limit(20)

    // Exclure mes communautés seulement si j'en ai
    if (myIds.length > 0) {
        publicQuery = publicQuery.not("id", "in", `(${myIds.join(",")})`)
    }

    const { data: publicCommunities } = await publicQuery

    return (
        <>
            {/* Note : Si ce bloc de configuration doit être interactif,
          il faudra le déplacer à l'intérieur de <CommunitiesClient /> */}
            <div className="flex items-center justify-between py-2 border-b mb-4">
                <div>
                    <p className="text-sm font-medium">Communautés</p>
                    <p className="text-xs text-muted-foreground">Explorez et gérez vos espaces de discussion</p>
                </div>
            </div>

            <CommunitiesClient
                myMemberships={myMemberships ?? []}
                publicCommunities={publicCommunities ?? []}
                currentUserId={user.id}
            />
        </>
    )
}