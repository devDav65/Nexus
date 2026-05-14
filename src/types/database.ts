export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> }
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> }
      conversation_members: { Row: ConversationMember; Insert: Partial<ConversationMember>; Update: Partial<ConversationMember> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  status: 'online' | 'away' | 'busy' | 'offline'
  last_seen_at: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string | null
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'system'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  reply_to_id: string | null
  is_edited: boolean
  is_deleted: boolean
  metadata: Json
  created_at: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string | null
  avatar_url: string | null
  created_by: string | null
  last_message_at: string | null
  last_message_preview: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ConversationMember {
  id: string
  conversation_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  last_read_at: string
  is_muted: boolean
}
