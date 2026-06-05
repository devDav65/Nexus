import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import ChatClient from "./ChatClient"

interface Props {
  params: { id: string }
}

export default async function ConversationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("role, is_muted")
    .eq("conversation_id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!membership) notFound()

  const { data: conversation } = await supabase
    .from("conversations")
    .select(`
      id, type, name, avatar_url,
      members:conversation_members (
        user_id, role,
        profile:profiles ( id, username, display_name, avatar_url, status )
      )
    `)
    .eq("id", params.id)
    .single()

  if (!conversation) notFound()

  const { data: messages } = await supabase
    .from("messages")
    .select(`
      id, content, type, status, created_at, is_edited, is_deleted,
      reply_to_id, sender_id,
      sender:profiles ( id, username, display_name, avatar_url ),
      reactions ( id, emoji, user_id ),
      attachments (*)
    `)
    .eq("conversation_id", params.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50)

  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", params.id)
    .eq("user_id", user.id)

  return (
    <ChatClient
      conversation={conversation as any}
      initialMessages={(messages ?? []).reverse()}
      currentUserId={user.id}
    />
  )
}
