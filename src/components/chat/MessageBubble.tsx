"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, CheckCheck, Pencil, Download, Play, Pause } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"

interface Props {
  message: any
  isOwn: boolean
  showAvatar: boolean
  isGrouped: boolean
}

function getName(sender: any): string {
  if (!sender) return "Utilisateur"
  return sender.display_name ?? `@${sender.username}` ?? "Utilisateur"
}

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
      <button onClick={toggle} className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors", isOwn ? "bg-white/20 hover:bg-white/30" : "bg-primary/20 hover:bg-primary/30")}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-0.5">
        <div className={cn("h-1.5 rounded-full cursor-pointer overflow-hidden", isOwn ? "bg-white/20" : "bg-muted-foreground/20")} onClick={seek}>
          <div className={cn("h-full rounded-full", isOwn ? "bg-white" : "bg-primary")} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
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

function VideoMessage({ url, name }: { url: string; name?: string }) {
  return (
    <div className="relative group max-w-[260px]">
      <video src={url} controls className="rounded-xl max-h-[200px] w-full" preload="metadata" />
      <a href={url} download={name ?? "video"}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Download className="w-3.5 h-3.5 text-white" />
      </a>
    </div>
  )
}

function FileMessage({ url, name, size, isOwn }: { url: string; name: string; size?: number; isOwn: boolean }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "FILE"
  const sizeStr = size ? size > 1048576 ? `${(size / 1048576).toFixed(1)} Mo` : `${Math.round(size / 1024)} Ko` : ""
  return (
    <a href={url} download={name}
      className={cn("flex items-center gap-3 px-3 py-2.5 min-w-[200px] max-w-[260px] hover:opacity-80 transition-opacity", isOwn ? "bg-white/10" : "bg-muted/50")}>
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

export default function MessageBubble({ message, isOwn, showAvatar, isGrouped }: Props) {
  const time = format(new Date(message.created_at), "HH:mm", { locale: fr })
  // Lire depuis attachments (nouveau) OU metadata (ancien)
  const meta = message.metadata ?? {}
  const attachment = message.attachments?.[0] ?? (
    (meta.audio_url || meta.file_url || meta.url)
      ? {
          url: meta.audio_url ?? meta.file_url ?? meta.url,
          file_name: meta.file_name ?? (message.type === 'audio' ? 'vocal.webm' : 'fichier'),
          file_size: meta.file_size ?? 0,
          mime_type: meta.mime_type ?? (message.type === 'audio' ? 'audio/webm' : 'application/octet-stream'),
          duration: meta.duration ?? 0,
        }
      : null
  )

  const reactionGroups = (message.reactions ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
    return acc
  }, {})

  const renderContent = () => {
    if (message.is_deleted) {
      return <span className="italic opacity-60 text-xs">Message supprimé</span>
    }

    const type = message.type as string

    // Récupérer l URL depuis attachment OU metadata
    const att = message.attachments?.[0]
    const meta = message.metadata ?? {}
    const audioUrl = att?.url ?? meta.audio_url ?? null
    const fileUrl = att?.url ?? meta.file_url ?? null
    const fileName = att?.file_name ?? meta.file_name ?? null
    const fileSize = att?.file_size ?? meta.file_size ?? null

    if (type === "audio" && audioUrl) {
      return <AudioPlayer url={audioUrl} isOwn={isOwn} />
    }

    if (type === "image" && fileUrl) {
      return (
        <div className="-mx-1 -mt-1">
          <ImageMessage url={fileUrl} name={fileName ?? "image"} />
        </div>
      )
    }

    if (type === "video" && fileUrl) {
      return (
        <div className="-mx-1 -mt-1">
          <VideoMessage url={fileUrl} name={fileName ?? "video"} />
        </div>
      )
    }

    if (type === "file" && fileUrl) {
      return (
        <FileMessage
          url={fileUrl}
          name={fileName ?? "fichier"}
          size={fileSize}
          isOwn={isOwn}
        />
      )
    }

    // Texte — ignorer le contenu legacy des anciens messages media
    const legacyPrefixes = ["🎤", "📷", "📎", "🖼️", "Message vocal", "Photo"]
    const isLegacy = legacyPrefixes.some(p => message.content?.includes(p))
    if (isLegacy) return null

    return (
      <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {message.content}
      </span>
    )
  }

  const isMedia = ["image", "video"].includes(message.type) && attachment?.url
  const isFile = message.type === "file" && attachment?.url

  return (
    <div className={cn("flex items-end gap-2 w-full", isOwn ? "flex-row-reverse" : "flex-row", isGrouped ? "mt-0.5" : "mt-3")}>
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

        <div className={cn(
          "relative rounded-2xl overflow-hidden",
          isMedia ? "p-1" : isFile ? "p-0" : "px-3 py-2",
          isOwn ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none"
        )}>
          {renderContent()}

          <div className={cn(
            "flex items-center gap-1 mt-0.5",
            isMedia ? "px-2 pb-1" : isFile ? "px-3 pb-2" : "",
            isOwn ? "justify-end" : "justify-start"
          )}>
            {message.is_edited && <Pencil className="w-2.5 h-2.5 opacity-40" />}
            <span className="text-[10px] opacity-50">{time}</span>
            {isOwn && (message.status === "read" ? <CheckCheck className="w-3 h-3 opacity-60" /> : <Check className="w-3 h-3 opacity-60" />)}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span key={emoji} className="bg-muted border border-border rounded-full px-2 py-0.5 text-xs cursor-pointer hover:bg-accent">
                {emoji} {(count as number) > 1 && count as number}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
