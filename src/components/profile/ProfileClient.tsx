"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Camera, Loader2, Check, LogOut, User, Bell, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const profileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, "Minuscules, chiffres et _ uniquement"),
  display_name: z.string().min(1, "Requis").max(50),
  bio: z.string().max(160, "160 caractères max").optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Confidentialité", icon: Shield },
]

interface ProfileClientProps {
  profile: any
  settings: any
  userId: string
}

export default function ProfileClient({ profile, settings, userId }: ProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState("profile")
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ProfileForm>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        username: profile?.username ?? "",
        display_name: profile?.display_name ?? "",
        bio: profile?.bio ?? "",
      },
    })

  // Upload avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Image trop lourde (max 5MB)"); return }

    setUploading(true)
    setError(null)

    const ext = file.name.split(".").pop()
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError("Erreur upload: " + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)

    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
    setAvatarUrl(publicUrl)
    setUploading(false)
    router.refresh()
  }

  // Sauvegarder le profil
  const onSubmit = async (data: ProfileForm) => {
    setError(null)

    // Vérifier unicité username si changé
    if (data.username !== profile?.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .neq("id", userId)
        .single()
      if (existing) { setError("Ce @username est déjà pris"); return }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: data.username,
        display_name: data.display_name,
        bio: data.bio ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) { setError(updateError.message); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const displayName = profile?.display_name ?? profile?.username ?? "?"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Réglages</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0 border-r border-border px-2 py-4 hidden md:block">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
                tab === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 px-6 py-6 max-w-xl">
          {tab === "profile" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  >
                    {uploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Camera className="w-3.5 h-3.5" />
                    }
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Changer la photo
                  </button>
                </div>
              </div>

              {/* Champs */}
              <div className="space-y-4">
                <div>
                  <Label>Nom affiché</Label>
                  <Input placeholder="Ton nom" {...register("display_name")} />
                  {errors.display_name && (
                    <p className="text-destructive text-xs mt-1">{errors.display_name.message}</p>
                  )}
                </div>

                <div>
                  <Label>@username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input className="pl-7" placeholder="username" {...register("username")} />
                  </div>
                  {errors.username && (
                    <p className="text-destructive text-xs mt-1">{errors.username.message}</p>
                  )}
                </div>

                <div>
                  <Label>Bio</Label>
                  <Textarea
                    placeholder="Parle de toi en quelques mots…"
                    rows={3}
                    className="resize-none"
                    {...register("bio")}
                  />
                  {errors.bio && (
                    <p className="text-destructive text-xs mt-1">{errors.bio.message}</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
              )}

              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : saved
                    ? <Check className="w-4 h-4" />
                    : null
                }
                {saved ? "Sauvegardé !" : "Sauvegarder"}
              </Button>
            </form>
          )}

          {tab === "notifications" && (
            <NotificationSettings settings={settings} userId={userId} />
          )}

          {tab === "privacy" && (
            <PrivacySettings settings={settings} userId={userId} />
          )}
        </div>
      </div>

      {/* Bottom nav mobile */}
      <div className="md:hidden flex border-t border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
              tab === id ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Notifications settings ─────────────────────────────────
function NotificationSettings({ settings, userId }: { settings: any; userId: string }) {
  const supabase = createClient()
  const [values, setValues] = useState({
    notifications_enabled: settings?.notifications_enabled ?? true,
    read_receipts: settings?.read_receipts ?? true,
    typing_indicators: settings?.typing_indicators ?? true,
    online_status_visible: settings?.online_status_visible ?? true,
  })

  const toggle = async (key: string) => {
    const newVal = !values[key as keyof typeof values]
    setValues(prev => ({ ...prev, [key]: newVal }))
    await supabase.from("user_settings").update({ [key]: newVal }).eq("user_id", userId)
  }

  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold mb-4">Notifications & Confidentialité</h2>
      {[
        { key: "notifications_enabled", label: "Activer les notifications" },
        { key: "read_receipts", label: "Accusés de lecture" },
        { key: "typing_indicators", label: "Indicateur de frappe" },
        { key: "online_status_visible", label: "Afficher mon statut en ligne" },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-3 border-b border-border/50">
          <span className="text-sm">{label}</span>
          <button
            onClick={() => toggle(key)}
            className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              values[key as keyof typeof values] ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn(
              "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
              values[key as keyof typeof values] ? "translate-x-5" : "translate-x-1"
            )} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Privacy settings ───────────────────────────────────────
function PrivacySettings({ settings, userId }: { settings: any; userId: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Confidentialité</h2>
      <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">
        <p>Les paramètres de confidentialité avancés seront disponibles prochainement.</p>
      </div>
    </div>
  )
}
