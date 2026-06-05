#!/bin/bash
echo "🚀 Ajout suppression/modification + statuts lecture..."

# ============================================================
# 1. MessageBubble avec menu contextuel + statuts
# ============================================================
cat > src/components/chat/MessageBubble.tsx << 'EOF'
"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, CheckCheck, Pencil, Download, Play, Pause, Trash2, Edit2, X, MoreVertical } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  message: any
  isOwn: boolean
  showAvatar: boolean
  isGrouped: boolean
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
}

function getName(sender: any): string {
  if (!sender) return "Utilisateur"
  return sender.display_name ?? `@${sender.username}` ?? "Utilisateur"
}

// ── Statut lecture WhatsApp-style ─────────────────────────
function MessageStatus({ status, isOwn }: { status: string; isOwn: boolean }) {
  if (!isOwn) return null
  return (
    <span className="ml-1">
      {status === "read"
        ? <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline" />
        : status === "delivered"
          ? <CheckCheck className="w-3.5 h-3.5 opacity-50 inline" />
          : <Check className="w-3.5 h-3.5 opacity-50 inline" />
      }
    </span>
  )
}

// ── Audio player ──────────────────────────────────────────
function AudioPlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onMeta = () => setDuration(a.duration)
    const onTime = () => { setCurrentTime(a.currentTime); setProgress((a.currentTime / a.duration) * 100) }
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0) }
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("ended", onEnd)
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd) }
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { a.play(); setPlaying(true) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration
  }

  const fmt = (s: number) => isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="flex items-center gap-2 w-52 py-1">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", isOwn ? "bg-white/20 hover:bg-white/30" : "bg-primary/20 hover:bg-primary/30")}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-0.5">
        <div className={cn("h-1.5 rounded-full cursor-pointer overflow-hidden", isOwn ? "bg-white/20" : "bg-muted-foreground/20")} onClick={seek}>
          <div className={cn("h-full rounded-full", isOwn ? "bg-white" : "bg-primary")} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}

function ImageMessage({ url, name }: { url: string; name?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setOpen(true)}>
        <img src={url} alt={name ?? "Image"} className="max-w-[260px] max-h-[200px] rounded-xl object-cover" loading="lazy" />
        <a href={url} download={name ?? "image"} onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Download className="w-3.5 h-3.5 text-white" />
        </a>
      </div>
      {open && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <img src={url} alt={name} className="max-w-full max-h-full rounded-xl object-contain" />
          <a href={url} download={name ?? "image"} onClick={e => e.stopPropagation()}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <Download className="w-5 h-5 text-white" />
          </a>
        </div>
      )}
    </>
  )
}

function FileMessage({ url, name, size, isOwn }: { url: string; name: string; size?: number; isOwn: boolean }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "FILE"
  const sizeStr = size ? size > 1048576 ? `${(size / 1048576).toFixed(1)} Mo` : `${Math.round(size / 1024)} Ko` : ""
  return (
    <a href={url} download={name} className={cn("flex items-center gap-3 px-3 py-2.5 min-w-[200px] max-w-[260px] hover:opacity-80 transition-opacity", isOwn ? "bg-white/10" : "bg-muted/50")}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold", isOwn ? "bg-white/20 text-white" : "bg-primary/20 text-primary")}>
        {ext.slice(0, 4)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {sizeStr && <p className="text-xs opacity-60">{sizeStr}</p>}
      </div>
      <Download className="w-4 h-4 shrink-0 opacity-60" />
    </a>
  )
}

export default function MessageBubble({ message, isOwn, showAvatar, isGrouped, onEdit, onDelete }: Props) {
  const supabase = createClient()
  const time = format(new Date(message.created_at), "HH:mm", { locale: fr })
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content ?? "")
  const [saving, setSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)

  // Fermer menu en cliquant dehors
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showMenu])

  // Focus textarea en mode édition
  useEffect(() => {
    if (editing) setTimeout(() => editRef.current?.focus(), 50)
  }, [editing])

  const meta = message.metadata ?? {}
  const att = message.attachments?.[0]
  const audioUrl = att?.url ?? meta.audio_url ?? null
  const fileUrl = att?.url ?? meta.file_url ?? null
  const fileName = att?.file_name ?? meta.file_name ?? null
  const fileSize = att?.file_size ?? meta.file_size ?? null

  // ── Supprimer ────────────────────────────────────────────
  const handleDelete = async () => {
    setShowMenu(false)
    await supabase.from("messages")
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), content: "Message supprimé" })
      .eq("id", message.id)
    onDelete?.(message.id)
  }

  // ── Modifier ─────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editValue.trim() || editValue === message.content) { setEditing(false); return }
    setSaving(true)
    await supabase.from("messages")
      .update({ content: editValue.trim(), is_edited: true, edited_at: new Date().toISOString() })
      .eq("id", message.id)
    onEdit?.(message.id, editValue.trim())
    setSaving(false)
    setEditing(false)
  }

  const reactionGroups = (message.reactions ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
    return acc
  }, {})

  const isMedia = ["image", "video"].includes(message.type) && fileUrl
  const isFile = message.type === "file" && fileUrl
  const isText = message.type === "text" && !message.is_deleted

  const renderContent = () => {
    if (message.is_deleted) return <span className="italic opacity-50 text-xs">🚫 Message supprimé</span>
    if (message.type === "audio" && audioUrl) return <AudioPlayer url={audioUrl} isOwn={isOwn} />
    if (message.type === "image" && fileUrl) return <div className="-mx-1 -mt-1"><ImageMessage url={fileUrl} name={fileName ?? "image"} /></div>
    if (message.type === "video" && fileUrl) return <div className="-mx-1 -mt-1"><video src={fileUrl} controls className="rounded-xl max-h-[200px] w-full max-w-[260px]" /></div>
    if (message.type === "file" && fileUrl) return <FileMessage url={fileUrl} name={fileName ?? "fichier"} size={fileSize} isOwn={isOwn} />
    const legacyPrefixes = ["🎤", "📷", "📎", "Message vocal", "Photo"]
    if (legacyPrefixes.some(p => message.content?.includes(p))) return null
    return <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</span>
  }

  return (
    <div className={cn("flex items-end gap-2 w-full group", isOwn ? "flex-row-reverse" : "flex-row", isGrouped ? "mt-0.5" : "mt-3")}>
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="w-7 h-7">
              <AvatarImage src={message.sender?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {getName(message.sender).replace("@", "").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : <div className="w-7 h-7" />}
        </div>
      )}

      <div className={cn("flex flex-col max-w-[75%]", isOwn ? "items-end" : "items-start")}>
        {!isOwn && showAvatar && (
          <p className="text-[11px] text-muted-foreground mb-1 ml-1">{getName(message.sender)}</p>
        )}

        {/* Bulle + bouton menu */}
        <div className="relative flex items-end gap-1" ref={menuRef}>
          {/* Bouton ··· — visible au hover */}
          {!message.is_deleted && (
            <button
              onClick={() => setShowMenu(p => !p)}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted mb-1 shrink-0",
                isOwn ? "order-first" : "order-last"
              )}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Bulle */}
          {editing ? (
            // ── Mode édition ──
            <div className="bg-muted rounded-2xl px-3 py-2 min-w-[200px] max-w-[280px]">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit() } if (e.key === "Escape") setEditing(false) }}
                className="w-full bg-transparent text-sm resize-none outline-none leading-relaxed"
                rows={2}
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Annuler</button>
                <button onClick={handleEdit} disabled={saving} className="text-[11px] text-primary font-medium hover:underline">
                  {saving ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "relative rounded-2xl overflow-hidden",
              isMedia ? "p-1" : isFile ? "p-0" : "px-3 py-2",
              isOwn ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none"
            )}>
              {renderContent()}
              <div className={cn("flex items-center gap-0.5 mt-0.5", isOwn ? "justify-end" : "justify-start")}>
                {message.is_edited && !message.is_deleted && <Pencil className="w-2.5 h-2.5 opacity-40" />}
                <span className="text-[10px] opacity-50">{time}</span>
                <MessageStatus status={message.status} isOwn={isOwn} />
              </div>
            </div>
          )}

          {/* Menu contextuel */}
          {showMenu && !editing && (
            <div className={cn(
              "absolute bottom-8 z-50 bg-background border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]",
              isOwn ? "right-0" : "left-0"
            )}>
              {isOwn && isText && (
                <button
                  onClick={() => { setEditing(true); setShowMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-primary" />
                  Modifier
                </button>
              )}
              {isOwn && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
              <button
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Réactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span key={emoji} className="bg-muted border border-border rounded-full px-2 py-0.5 text-xs cursor-pointer hover:bg-accent">
                {emoji} {(count as number) > 1 && count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
EOF
echo "✓ MessageBubble avec menu + statuts"

# ============================================================
# 2. MessageList — passer les callbacks edit/delete
# ============================================================
cat > src/components/chat/MessageList.tsx << 'EOF'
"use client"
import { RefObject } from "react"
import MessageBubble from "./MessageBubble"

interface Props {
  messages: any[]
  currentUserId: string
  typingUsers: string[]
  bottomRef: RefObject<HTMLDivElement>
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
}

export default function MessageList({ messages, currentUserId, typingUsers, bottomRef, onEdit, onDelete }: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Aucun message. Soyez le premier à écrire !</p>
        </div>
      )}
      {messages.map((msg, i) => {
        const prevMsg = messages[i - 1]
        const msgSenderId = msg.sender_id ?? msg.sender?.id
        const prevSenderId = prevMsg ? (prevMsg.sender_id ?? prevMsg.sender?.id) : null
        const isOwn = msgSenderId === currentUserId
        const showAvatar = !isOwn && prevSenderId !== msgSenderId
        const isGrouped = !!prevMsg && prevSenderId === msgSenderId &&
          new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
            isGrouped={isGrouped}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      })}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground">{typingUsers.join(", ")} est en train d'écrire…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
EOF
echo "✓ MessageList mis à jour"

echo ""
echo "✅ Done ! Lance : pnpm dev"
echo ""
echo "📋 SQL à exécuter dans Supabase pour les statuts de lecture :"
cat << 'SQL'
-- Trigger : marquer les messages comme "delivered" à la réception
CREATE OR REPLACE FUNCTION public.mark_messages_delivered()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.messages
  SET status = 'delivered'
  WHERE conversation_id = NEW.conversation_id
    AND sender_id != NEW.user_id
    AND status = 'sent';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_member_read ON public.conversation_members;
CREATE TRIGGER on_member_read
  AFTER UPDATE OF last_read_at ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.mark_messages_delivered();
SQL
