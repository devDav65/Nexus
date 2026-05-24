"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  storyId: string
  mediaUrl: string
  currentUserId: string
  onDeleted: () => void
}

export default function DeleteStoryButton({ storyId, mediaUrl, currentUserId, onDeleted }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    const supabase = createClient()

    console.log("🔴 Suppression story:", storyId, "user:", currentUserId)

    const { error: dbError, count } = await supabase
      .from("stories")
      .delete({ count: "exact" })
      .eq("id", storyId)
      .eq("user_id", currentUserId)

    console.log("Résultat DB:", { dbError, count })

    if (dbError) {
      setError(dbError.message)
      setDeleting(false)
      return
    }

    // Storage
    try {
      const url = new URL(mediaUrl)
      const parts = url.pathname.split("/object/public/stories/")
      if (parts[1]) {
        const path = decodeURIComponent(parts[1])
        console.log("Suppression storage path:", path)
        const { error: se } = await supabase.storage.from("stories").remove([path])
        if (se) console.warn("Storage:", se.message)
      }
    } catch (e) {
      console.warn("URL parse error:", e)
    }

    setDeleting(false)
    onDeleted()
  }

  if (!confirm) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setConfirm(true)
        }}
        className="text-white/80 hover:text-red-400 p-2 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-background rounded-2xl p-6 mx-6 w-full max-w-xs space-y-4 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="font-semibold text-sm">Supprimer cette story ?</h3>
          <p className="text-xs text-muted-foreground">
            Cette action est irréversible.
          </p>
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setConfirm(false)}
            disabled={deleting}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 gap-1"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            {deleting ? "Suppression…" : "Supprimer"}
          </Button>
        </div>
      </div>
    </div>
  )
}
