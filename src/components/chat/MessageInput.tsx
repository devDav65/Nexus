"use client"

import {
  useState,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { Paperclip, Smile, Send, Mic, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat.store"

interface MessageInputProps {
  conversationId: string
  currentUserId: string     // ← string UUID, plus simple
  onTyping: () => void
}

export default function MessageInput({
                                       conversationId,
                                       currentUserId,
                                       onTyping,
                                     }: MessageInputProps) {
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  const { replyTo, setReplyTo } = useChatStore()

  const handleSend = useCallback(async () => {
    const content = text.trim()
    if ((!content && !uploadingFile) || sending) return

    setSending(true)
    const tempText = content
    setText("")
    setReplyTo(null)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    try {
      // Upload fichier
      let attachmentData: any = null
      if (uploadingFile) {
        const ext = uploadingFile.name.split(".").pop()
        const path = `${currentUserId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
            .from("attachments")
            .upload(path, uploadingFile)

        if (!upErr) {
          const { data: urlData } = supabase.storage
              .from("attachments")
              .getPublicUrl(path)
          attachmentData = {
            url: urlData.publicUrl,
            path,
            name: uploadingFile.name,
            size: uploadingFile.size,
            mime_type: uploadingFile.type,
          }
        }
        setUploadingFile(null)
        setUploadPreview(null)
      }

      const msgType = attachmentData
          ? uploadingFile?.type.startsWith("image/") ? "image" : "file"
          : "text"

      const { data: newMsg, error: msgErr } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: tempText || null,
            type: msgType,
            reply_to_id: replyTo?.id ?? null,
            status: "sent",
          })
          .select("id")
          .single()

      if (msgErr) throw msgErr

      if (attachmentData && newMsg) {
        await supabase.from("attachments").insert({
          message_id: newMsg.id,
          user_id: currentUserId,
          file_name: attachmentData.name,
          file_size: attachmentData.size,
          mime_type: attachmentData.mime_type,
          storage_path: attachmentData.path,
          url: attachmentData.url,
        })
      }
    } catch (err) {
      console.error("Erreur envoi:", err)
      setText(tempText)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [text, sending, uploadingFile, conversationId, currentUserId, replyTo])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    onTyping()
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 140) + "px"
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(file)
    if (file.type.startsWith("image/")) {
      setUploadPreview(URL.createObjectURL(file))
    }
    e.target.value = ""
  }

  const cancelUpload = () => {
    setUploadingFile(null)
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
  }

  const hasContent = text.trim() || uploadingFile

  return (
      <div className="shrink-0 border-t border-border bg-background px-3 py-2">
        {/* Reply preview */}
        {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-muted/50 border-l-2 border-primary">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary font-medium truncate">
                  ↩ {replyTo.sender?.display_name ?? `@${replyTo.sender?.username}` ?? "Message"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {replyTo.content ?? "📎 Fichier"}
                </p>
              </div>
              <button onClick={() => setReplyTo(null)}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
        )}

        {/* Preview fichier */}
        {uploadingFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-muted/50">
              {uploadPreview ? (
                  <img src={uploadPreview} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{uploadingFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadingFile.size / 1024).toFixed(0)} Ko
                </p>
              </div>
              <button onClick={cancelUpload}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
        )}

        <div className="flex items-end gap-2">
          <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
              onChange={handleFileSelect}
          />
          <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-full text-muted-foreground shrink-0 mb-0.5"
              onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-4.5 h-4.5" />
          </Button>

          <div className="flex-1 relative">
          <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              disabled={sending}
              className={cn(
                  "w-full resize-none rounded-2xl px-4 py-2.5 pr-10 text-sm leading-relaxed",
                  "bg-white border border-transparent", // J'ai mis bg-white pour correspondre à ton image
                  "focus:outline-none focus:border-border",
                  "text-black", // <--- Ajoute ceci pour le texte que tu saisis
                  "placeholder:text-black/60", // <--- Ajoute ceci pour le placeholder (60% d'opacité pour différencier)
                  "transition-colors",
                  "max-h-[140px] disabled:opacity-50"
              )}
          />
            <button className="absolute right-3 bottom-2.5 text-black">
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <Button
              type="button"
              size="icon"
              onClick={hasContent ? handleSend : undefined}
              disabled={sending}
              className={cn(
                  "w-9 h-9 rounded-full shrink-0 mb-0.5 transition-all",
                  hasContent
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground"
              )}
          >
            {hasContent ? <Send className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        </div>
      </div>
  )
}