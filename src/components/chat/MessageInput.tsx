"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Send, Paperclip, Smile, Mic, Square, Loader2, X, Image, File } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onTyping: (isTyping: boolean) => void
  disabled?: boolean
  conversationId?: string
  currentUserId?: string
}

export default function MessageInput({
                                       onSend, onTyping, disabled, conversationId, currentUserId
                                     }: MessageInputProps) {
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout>()

  // ── Envoi texte ────────────────────────────────────────────
  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    await onSend(content)
    setContent("")
    setSending(false)
    onTyping(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    onTyping(e.target.value.length > 0)
    const ta = textareaRef.current
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px" }
  }

  // ── Emoji ──────────────────────────────────────────────────
  const insertEmoji = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji
    const ta = textareaRef.current
    if (!ta) { setContent(prev => prev + emoji); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newVal = content.slice(0, start) + emoji + content.slice(end)
    setContent(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
    onTyping(true)
  }

  // ── Upload fichier/image — CORRIGÉ : stockage dans attachments ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversationId || !currentUserId) return
    if (file.size > 50 * 1024 * 1024) { alert("Fichier trop lourd (max 50MB)"); return }

    setUploading(true)
    setShowAttach(false)

    const ext = file.name.split(".").pop()
    const path = `${currentUserId}/${Date.now()}.${ext}`

    // Déterminer le type
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    const msgType = isImage ? "image" : isVideo ? "video" : "file"

    const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file, { upsert: true })

    if (uploadError) { setUploading(false); alert("Erreur upload: " + uploadError.message); return }

    const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path)

    // Insérer le message
    const { data: msg, error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: null,
      type: msgType,
      status: "sent",
    }).select("id").single()

    if (!msgError && msg) {
      // Insérer l'attachment dans la table attachments
      await supabase.from("attachments").insert({
        message_id: msg.id,
        user_id: currentUserId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: path,
        url: publicUrl,
        // Dimensions image si possible
        width: null,
        height: null,
      })
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Vocal — CORRIGÉ : stockage dans attachments ────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await uploadAudio(new Blob(chunksRef.current, { type: "audio/webm" }))
      }
      mr.start()
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(p => {
        if (p >= 120) { stopRecording(); return p }
        return p + 1
      }), 1000)
    } catch { alert("Microphone non disponible") }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    setRecording(false)
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
  }

  const uploadAudio = async (blob: Blob) => {
    if (!conversationId || !currentUserId) return
    setUploadingAudio(true)

    const path = `${currentUserId}/${Date.now()}.webm`
    const { error } = await supabase.storage
        .from("attachments")
        .upload(path, blob, { contentType: "audio/webm", upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path)

      // Insérer le message audio
      const { data: msg, error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: null,
        type: "audio",
        status: "sent",
        metadata: { duration: recordingTime },
      }).select("id").single()

      if (!msgError && msg) {
        // Insérer dans la table attachments
        await supabase.from("attachments").insert({
          message_id: msg.id,
          user_id: currentUserId,
          file_name: `vocal_${Date.now()}.webm`,
          file_size: blob.size,
          mime_type: "audio/webm",
          storage_path: path,
          url: publicUrl,
          duration: recordingTime,
        })
      }
    }

    setUploadingAudio(false)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  const canSend = content.trim().length > 0 && !sending && !disabled

  return (
      <div className="shrink-0 bg-background safe-bottom">
        {/* Picker emoji */}
        {showEmoji && (
            <div className="border-t border-border bg-background">
              <EmojiPicker
                  onEmojiClick={insertEmoji}
                  theme={"dark" as Theme}
                  width="100%"
                  height={350}
                  searchPlaceholder="Rechercher un emoji…"
                  lazyLoadEmojis
              />
            </div>
        )}

        {/* Menu pièce jointe */}
        {showAttach && (
            <div className="border-t border-border px-4 py-3 bg-background flex gap-3">
              <button
                  onClick={() => { fileInputRef.current!.accept = "image/*,video/*"; fileInputRef.current!.click(); setShowAttach(false) }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
              >
                <Image className="w-6 h-6" />
                <span className="text-[10px] font-medium">Photo/Vidéo</span>
              </button>
              <button
                  onClick={() => { fileInputRef.current!.accept = "*/*"; fileInputRef.current!.click(); setShowAttach(false) }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
              >
                <File className="w-6 h-6" />
                <span className="text-[10px] font-medium">Fichier</span>
              </button>
              <button
                  onClick={() => setShowAttach(false)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors ml-auto"
              >
                <X className="w-6 h-6" />
                <span className="text-[10px] font-medium">Annuler</span>
              </button>
            </div>
        )}

        {/* Barre enregistrement */}
        {recording && (
            <div className="flex items-center gap-3 bg-red-500/10 border-t border-red-500/20 px-4 py-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-500 font-medium flex-1">
            Enregistrement… {formatTime(recordingTime)}
          </span>
              <button
                  onClick={stopRecording}
                  className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
              >
                <Square className="w-3 h-3" /> Envoyer
              </button>
            </div>
        )}

        {/* Input principal */}
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-end gap-2 bg-muted/50 rounded-2xl px-3 py-2 border border-border focus-within:border-primary/50 transition-colors">

            {/* Trombone */}
            <button
                onClick={() => { setShowAttach(p => !p); setShowEmoji(false) }}
                disabled={uploading || disabled}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-colors",
                    showAttach ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                )}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>

            {/* Textarea */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={recording ? "Enregistrement…" : "Message…"}
                rows={1}
                disabled={disabled || recording}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground max-h-[120px] py-1 leading-relaxed"
            />

            {/* Emoji */}
            <button
                onClick={() => { setShowEmoji(p => !p); setShowAttach(false) }}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-colors",
                    showEmoji ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                )}
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Envoyer / Micro */}
            {canSend ? (
                <button
                    onClick={handleSend}
                    disabled={sending}
                    className="w-8 h-8 rounded-full shrink-0 mb-0.5 bg-primary text-primary-foreground flex items-center justify-center"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
            ) : (
                <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={uploadingAudio || disabled}
                    className={cn(
                        "w-8 h-8 rounded-full shrink-0 mb-0.5 flex items-center justify-center transition-colors",
                        recording ? "bg-red-500 text-white" : "text-muted-foreground hover:text-primary"
                    )}
                >
                  {uploadingAudio
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : recording
                          ? <Square className="w-3.5 h-3.5" />
                          : <Mic className="w-3.5 h-3.5" />
                  }
                </button>
            )}
          </div>
        </div>

        {/* Input fichier caché */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
      </div>
  )
}