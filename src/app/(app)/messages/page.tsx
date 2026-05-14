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
    .order("conversation(last_message_at)", { ascending: false })
    .limit(40);

  return (
    <MessagesListClient
      initialConversations={memberships ?? []}
      currentUserId={user!.id}
    />
  );
}
