import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CallsClient from "./CallsClient"

export default async function CallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Historique complet des appels (envoyés + reçus)
  const { data: calls } = await supabase
    .from("calls")
    .select(`
      id, type, status, started_at, ended_at, created_at,
      caller:profiles!calls_caller_id_fkey ( id, username, display_name, avatar_url ),
      callee:profiles!calls_callee_id_fkey ( id, username, display_name, avatar_url )
    `)
    .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50)

  // Contacts récents pour appeler directement
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select(`
      conversation:conversations (
        type,
        members:conversation_members (
          user_id,
          profile:profiles ( id, username, display_name, avatar_url, status )
        )
      )
    `)
    .eq("user_id", user.id)
    .limit(15)

  const contacts = (memberships ?? [])
    .map((m: any) => {
      const conv = m.conversation
      if (conv?.type !== "direct") return null
      return conv.members?.find((mem: any) => mem.user_id !== user.id)?.profile ?? null
    })
    .filter(Boolean)
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === c.id) === i)

  return (
    <CallsClient
      calls={calls ?? []}
      contacts={contacts}
      currentUserId={user.id}
    />
  )
}
