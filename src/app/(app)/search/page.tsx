"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useDebounce } from "@/hooks/useDebounce"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Search, MessageSquare, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SearchPage() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [dmError, setDmError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 350)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setResults([]); return }
    setLoading(true)
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, status")
      .ilike("username", `%${debouncedQuery}%`)
      .limit(20)
      .then(({ data }) => { setResults(data ?? []); setLoading(false) })
  }, [debouncedQuery])

  const startDM = async (userId: string) => {
    setStarting(userId)
    setDmError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDmError("Non connecté"); setStarting(null); return }

    // Essai via RPC
    const { data: convId, error: rpcError } = await supabase.rpc("get_or_create_dm", {
      user_a: user.id,
      user_b: userId,
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      // Fallback : créer manuellement la conversation
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ type: "direct", created_by: user.id })
        .select("id")
        .single()

      if (convError || !conv) {
        setDmError("Erreur : " + (convError?.message ?? "impossible de créer la conversation"))
        setStarting(null)
        return
      }

      await supabase.from("conversation_members").insert([
        { conversation_id: conv.id, user_id: user.id, role: "admin" },
        { conversation_id: conv.id, user_id: userId, role: "member" },
      ])

      router.push(`/messages/${conv.id}`)
      setStarting(null)
      return
    }

    if (!convId) {
      setDmError("La fonction RPC n'a rien retourné")
      setStarting(null)
      return
    }

    router.push(`/messages/${convId}`)
    setStarting(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <h1 className="text-lg font-semibold mb-3">Rechercher</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un @username…"
            className="pl-9 h-10"
            autoFocus
          />
        </div>
        {dmError && (
          <div className="flex items-center gap-2 mt-2 text-destructive text-xs bg-destructive/10 px-3 py-2 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {dmError}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center pt-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 text-muted-foreground gap-2">
            <p className="text-sm">Aucun utilisateur trouvé pour « {query} »</p>
          </div>
        )}
        {!loading && query.length < 2 && (
          <div className="flex flex-col items-center justify-center pt-16 text-muted-foreground gap-2">
            <Search className="w-10 h-10 opacity-20" />
            <p className="text-sm">Tape un @username pour trouver quelqu'un</p>
          </div>
        )}
        {results.map((profile) => (
          <div key={profile.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="relative shrink-0">
              <Avatar className="w-11 h-11">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {(profile.display_name ?? profile.username ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.status === "online" && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.display_name ?? profile.username}</p>
              <p className="text-xs text-muted-foreground">@{profile.username}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={() => startDM(profile.id)}
              disabled={starting === profile.id}
            >
              {starting === profile.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <MessageSquare className="w-3.5 h-3.5" />
              }
              Message
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
