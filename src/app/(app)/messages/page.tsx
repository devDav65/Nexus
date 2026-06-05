import { createClient } from "@/lib/supabase/server";
import MessagesListClient from "./MessagesListClient";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select(`
      last_read_at,
      is_muted,
      conversation:conversations (
        id, type, name, avatar_url, last_message_at, last_message_preview,
        members:conversation_members (
          user_id,
          profile:profiles ( id, username, display_name, avatar_url, status )
        )
      )
    `)
    .eq("user_id", user!.id)
    .limit(40);
  // Trier par last_message_at côté serveur
  const sorted = (memberships ?? []).sort((a: any, b: any) => {
    const aTime = a.conversation?.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
    const bTime = b.conversation?.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
    return bTime - aTime
  })

  return (
    <MessagesListClient
      initialConversations={sorted}
      currentUserId={user!.id}
    />
  );
}
