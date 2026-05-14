import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import ChatClient from "./ChatClient"

interface PageProps {
  params: { id: string }
}

export default async function ChatPage({ params }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Vérifier membership
  const { data: membership } = await supabase
      .from("conversation_members")
      .select("*")
      .eq("conversation_id", params.id)
      .eq("user_id", user.id)
      .single()

  if (!membership) notFound()

  // Conversation + membres
  const { data: conversation } = await supabase
      .from("conversations")
      .select(`
      *,
      members:conversation_members (
        user_id,
        role,
        profile:profiles (
          id,
          username,
          display_name,
          avatar_url,
          status
        )
      )
    `)
      .eq("id", params.id)
      .single()

  if (!conversation) notFound()

  // Messages initiaux
  const { data: initialMessages } = await supabase
      .from("messages")
      .select(`
      *,
      sender:profiles (
        id,
        username,
        display_name,
        avatar_url
      ),
      attachments (*),
      reactions (*)
    `)
      .eq("conversation_id", params.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(40)

  // Marquer comme lu
  await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", params.id)
      .eq("user_id", user.id)


  // Dans src/app/(app)/messages/[id]/page.tsx
// juste avant le return()

  console.log("=== SERVER DEBUG ===")
  console.log("user.id:", user.id)
  console.log("initialMessages count:", initialMessages.length)
  console.log("premier sender_id:", initialMessages[0]?.sender_id)
  console.log("===================")


  // ⚠️ CRITIQUE : utiliser user.id directement (UUID auth)
  // PAS le profil — le sender_id dans messages = auth.uid()
  return (
      <ChatClient
          conversation={conversation}
          initialMessages={(initialMessages ?? []).reverse()}
          currentUserId={user.id}   // ← string UUID direct depuis auth
      />
  )
}
