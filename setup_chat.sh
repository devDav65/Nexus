#!/bin/bash
# ============================================================
# NEXUS — Chat temps réel (étape 7)
# Exécuter depuis la racine du projet : bash setup_chat.sh
# ============================================================

echo "🚀 Création des fichiers chat temps réel..."
mkdir -p src/app/\(app\)/messages/\[id\]
mkdir -p src/components/chat
mkdir -p src/app/\(app\)/search

# ============================================================
# 1. Page conversation [id] — Server Component
# ============================================================
cat > "src/app/(app)/messages/[id]/page.tsx" << 'EOF'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import ChatContainer from "@/components/chat/ChatContainer"

interface Props {
  params: { id: string }
}

export default async function ConversationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Vérifier que l'utilisateur est membre de cette conversation
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("role, is_muted")
    .eq("conversation_id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!membership) notFound()

  // Charger la conversation
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

  // Charger les 50 derniers messages
  const { data: messages } = await supabase
    .from("messages")
    .select(`
      id, content, type, status, created_at, is_edited, is_deleted,
      reply_to_id,
      sender:profiles ( id, username, display_name, avatar_url ),
      reactions ( id, emoji, user_id )
    `)
    .eq("conversation_id", params.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50)

  // Marquer comme lu
  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: params.id,
    p_user_id: user.id,
  })

  return (
    <ChatContainer
      conversation={conversation as any}
      initialMessages={(messages ?? []).reverse()}
      currentUserId={user.id}
      currentUserProfile={
        conversation.members?.find((m: any) => m.user_id === user.id)?.profile
      }
    />
  )
}
EOF
echo "✓ src/app/(app)/messages/[id]/page.tsx"

# ============================================================
# 2. ChatContainer — orchestrateur principal
# ============================================================
cat > src/components/chat/ChatContainer.tsx << 'EOF'
"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import ChatHeader from "./ChatHeader"
import MessageList from "./MessageList"
import MessageInput from "./MessageInput"

interface ChatContainerProps {
  conversation: any
  initialMessages: any[]
  currentUserId: string
  currentUserProfile: any
}

export default function ChatContainer({
  conversation,
  initialMessages,
  currentUserId,
  currentUserProfile,
}: ChatContainerProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const isDM = conversation.type === "direct"
  const otherMember = isDM
    ? conversation.members?.find((m: any) => m.user_id !== currentUserId)
    : null

  // Scroll au dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Realtime — nouveaux messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          // Enrichir le message avec le profil sender
          const { data: fullMessage } = await supabase
            .from("messages")
            .select(`
              id, content, type, status, created_at, is_edited, is_deleted,
              reply_to_id,
              sender:profiles ( id, username, display_name, avatar_url ),
              reactions ( id, emoji, user_id )
            `)
            .eq("id", payload.new.id)
            .single()

          if (fullMessage && !fullMessage.is_deleted) {
            setMessages((prev) => [...prev, fullMessage])

            // Marquer comme lu si c'est pas moi qui ai envoyé
            if (payload.new.sender_id !== currentUserId) {
              await supabase.rpc("mark_conversation_read", {
                p_conversation_id: conversation.id,
                p_user_id: currentUserId,
              })
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, ...payload.new } : m
            )
          )
        }
      )
      // Typing indicator via Presence
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const typing = Object.values(state)
          .flat()
          .filter((p: any) => p.typing && p.user_id !== currentUserId)
          .map((p: any) => p.display_name ?? p.user_id)
        setTypingUsers(typing as string[])
      })
      .subscribe(async () => {
        await channel.track({
          user_id: currentUserId,
          display_name: currentUserProfile?.display_name ?? "Utilisateur",
          typing: false,
        })
      })

    return () => { supabase.removeChannel(channel) }
  }, [conversation.id, currentUserId])

  // Envoyer un message
  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: content.trim(),
      type: "text",
    })

    if (error) console.error("Erreur envoi:", error)
  }

  // Typing indicator
  const handleTyping = async (isTyping: boolean) => {
    const channel = supabase.channel(`chat:${conversation.id}`)
    await channel.track({
      user_id: currentUserId,
      display_name: currentUserProfile?.display_name,
      typing: isTyping,
    })

    if (isTyping) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation}
        otherMember={otherMember}
        currentUserId={currentUserId}
      />
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsers={typingUsers}
        bottomRef={bottomRef}
      />
      <MessageInput
        onSend={sendMessage}
        onTyping={handleTyping}
        disabled={false}
      />
    </div>
  )
}
EOF
echo "✓ src/components/chat/ChatContainer.tsx"

# ============================================================
# 3. ChatHeader
# ============================================================
cat > src/components/chat/ChatHeader.tsx << 'EOF'
"use client"

import Link from "next/link"
import { ArrowLeft, Phone, Video, Info } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatHeaderProps {
  conversation: any
  otherMember: any
  currentUserId: string
}

export default function ChatHeader({ conversation, otherMember }: ChatHeaderProps) {
  const isDM = conversation.type === "direct"

  const displayName = isDM
    ? otherMember?.profile?.display_name ?? `@${otherMember?.profile?.username}`
    : conversation.name ?? "Groupe"

  const avatarUrl = isDM ? otherMember?.profile?.avatar_url : conversation.avatar_url
  const status = otherMember?.profile?.status
  const isOnline = status === "online"

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-md">
      {/* Retour mobile */}
      <Link href="/messages" className="md:hidden">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>

      {/* Avatar + statut */}
      <div className="relative">
        <Avatar className="w-9 h-9">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isDM && (
          <span
            className={cn(
              "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
              isOnline ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        )}
      </div>

      {/* Nom + statut */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        {isDM && (
          <p className="text-xs text-muted-foreground">
            {isOnline ? "En ligne" : "Hors ligne"}
          </p>
        )}
        {!isDM && (
          <p className="text-xs text-muted-foreground">
            {conversation.members?.length ?? 0} membres
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground">
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground">
          <Video className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground">
          <Info className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
EOF
echo "✓ src/components/chat/ChatHeader.tsx"

# ============================================================
# 4. MessageList
# ============================================================
cat > src/components/chat/MessageList.tsx << 'EOF'
"use client"

import { RefObject } from "react"
import MessageBubble from "./MessageBubble"

interface MessageListProps {
  messages: any[]
  currentUserId: string
  typingUsers: string[]
  bottomRef: RefObject<HTMLDivElement>
}

export default function MessageList({
  messages,
  currentUserId,
  typingUsers,
  bottomRef,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Aucun message. Soyez le premier à écrire !</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const prevMsg = messages[i - 1]
        const isOwn = msg.sender?.id === currentUserId
        const showAvatar =
          !isOwn && (!prevMsg || prevMsg.sender?.id !== msg.sender?.id)
        const isGrouped =
          prevMsg &&
          prevMsg.sender?.id === msg.sender?.id &&
          new Date(msg.created_at).getTime() -
            new Date(prevMsg.created_at).getTime() <
            60000

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
            isGrouped={!!isGrouped}
          />
        )
      })}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground">
            {typingUsers.join(", ")} est en train d'écrire…
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
EOF
echo "✓ src/components/chat/MessageList.tsx"

# ============================================================
# 5. MessageBubble
# ============================================================
cat > src/components/chat/MessageBubble.tsx << 'EOF'
"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, CheckCheck, Pencil } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  message: any
  isOwn: boolean
  showAvatar: boolean
  isGrouped: boolean
}

export default function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isGrouped,
}: MessageBubbleProps) {
  const time = format(new Date(message.created_at), "HH:mm", { locale: fr })

  // Grouper les réactions par emoji
  const reactionGroups = (message.reactions ?? []).reduce(
    (acc: Record<string, number>, r: any) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOwn ? "flex-row-reverse" : "flex-row",
        isGrouped ? "mt-0.5" : "mt-3"
      )}
    >
      {/* Avatar expéditeur (conversations de groupe) */}
      {!isOwn && (
        <div className="w-7 shrink-0">
          {showAvatar ? (
            <Avatar className="w-7 h-7">
              <AvatarImage src={message.sender?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {(message.sender?.display_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}

      {/* Bulle */}
      <div className={cn("max-w-[70%] group", isOwn && "items-end")}>
        {/* Nom expéditeur (groupe, premier de la séquence) */}
        {!isOwn && showAvatar && (
          <p className="text-[11px] text-muted-foreground mb-1 ml-1">
            {message.sender?.display_name ?? `@${message.sender?.username}`}
          </p>
        )}

        <div
          className={cn(
            "relative px-3 py-2 rounded-2xl text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          )}
        >
          {message.content}

          {/* Heure + statut */}
          <div
            className={cn(
              "flex items-center gap-1 mt-1",
              isOwn ? "justify-end" : "justify-start"
            )}
          >
            {message.is_edited && (
              <Pencil className="w-2.5 h-2.5 opacity-50" />
            )}
            <span className={cn("text-[10px] opacity-60")}>
              {time}
            </span>
            {isOwn && (
              <span className="opacity-70">
                {message.status === "read" ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Réactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1 mt-1",
              isOwn ? "justify-end" : "justify-start"
            )}
          >
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span
                key={emoji}
                className="bg-muted border border-border rounded-full px-2 py-0.5 text-xs flex items-center gap-1"
              >
                {emoji} <span className="text-muted-foreground">{count as number}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
EOF
echo "✓ src/components/chat/MessageBubble.tsx"

# ============================================================
# 6. MessageInput
# ============================================================
cat > src/components/chat/MessageInput.tsx << 'EOF'
"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Send, Paperclip, Smile } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onTyping: (isTyping: boolean) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onTyping, disabled }: MessageInputProps) {
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    await onSend(content)
    setContent("")
    setSending(false)
    onTyping(false)
    // Reset hauteur textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    onTyping(e.target.value.length > 0)

    // Auto-resize textarea
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
    }
  }

  const canSend = content.trim().length > 0 && !sending && !disabled

  return (
    <div className="shrink-0 px-4 py-3 border-t border-border bg-background">
      <div className="flex items-end gap-2 bg-muted/50 rounded-2xl px-3 py-2 border border-border focus-within:border-primary/50 transition-colors">
        {/* Attachement */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-muted-foreground shrink-0 mb-0.5"
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground max-h-[120px] py-1 leading-relaxed"
        />

        {/* Emoji */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-muted-foreground shrink-0 mb-0.5"
        >
          <Smile className="w-4 h-4" />
        </Button>

        {/* Envoyer */}
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "w-8 h-8 rounded-full shrink-0 mb-0.5 transition-all",
            canSend ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-center mt-1">
        Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
      </p>
    </div>
  )
}
EOF
echo "✓ src/components/chat/MessageInput.tsx"

# ============================================================
# 7. Page search placeholder
# ============================================================
cat > src/app/\(app\)/search/page.tsx << 'EOF'
export default function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <p className="text-lg font-medium">Recherche</p>
      <p className="text-sm">Bientôt disponible</p>
    </div>
  )
}
EOF
echo "✓ src/app/(app)/search/page.tsx"

# ============================================================
# 8. Pages placeholder (stories, communities, calls, settings)
# ============================================================
for page in stories communities calls settings; do
  mkdir -p src/app/\(app\)/$page
  cat > src/app/\(app\)/$page/page.tsx << PAGEOF
export default function ${page^}Page() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <p className="text-lg font-medium capitalize">${page}</p>
      <p className="text-sm">Bientôt disponible</p>
    </div>
  )
}
PAGEOF
  echo "✓ src/app/(app)/$page/page.tsx"
done

# ============================================================
# 9. Page d'accueil → redirect vers /messages
# ============================================================
cat > src/app/page.tsx << 'EOF'
import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/messages")
}
EOF
echo "✓ src/app/page.tsx"

echo ""
echo "✅ Chat temps réel créé !"
echo ""
echo "Fichiers créés :"
echo "  src/app/(app)/messages/[id]/page.tsx"
echo "  src/components/chat/ChatContainer.tsx"
echo "  src/components/chat/ChatHeader.tsx"
echo "  src/components/chat/MessageList.tsx"
echo "  src/components/chat/MessageBubble.tsx"
echo "  src/components/chat/MessageInput.tsx"
echo "  src/app/(app)/search/page.tsx"
echo "  src/app/(app)/stories,communities,calls,settings/page.tsx"
echo "  src/app/page.tsx"
echo ""
echo "👉 Lance : pnpm dev"