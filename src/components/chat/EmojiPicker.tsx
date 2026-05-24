"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { Smile } from "lucide-react"
import { useState } from "react"

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false })

interface Props {
  onEmojiSelect: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer en cliquant ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-8 right-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
          <Picker
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji)
              setOpen(false)
            }}
            theme="dark"
            skinTonesDisabled
            searchPlaceholder="Rechercher..."
            height={380}
            width={320}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  )
}
