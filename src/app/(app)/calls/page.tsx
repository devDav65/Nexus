import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CallsClient from "./CallsClient"

export default async function CallsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    // Historique d'appels (via notifications type call_missed)
    const { data: callHistory } = await supabase
        .from("notifications")
        .select(`
      id, title, body, data, created_at, is_read,
      type
    `)
        .eq("user_id", user.id)
        .eq("type", "call_missed")
        .order("created_at", { ascending: false })
        .limit(30)

    // Contacts récents (dernières conversations)
    const { data: recentContacts } = await supabase
        .from("conversation_members")
        .select(`
      conversation:conversations (
        id, type,
        members:conversation_members (
          user_id,
          profile:profiles ( id, username, display_name, avatar_url, status )
        )
      )
    `)
        .eq("user_id", user.id)
        .order("conversation(last_message_at)", { ascending: false })
        .limit(10)

    return (
        <CallsClient
            callHistory={callHistory ?? []}
            recentContacts={recentContacts ?? []}
            currentUserId={user.id}
        />
    )
}
