#!/bin/bash
# ============================================================
# NEXUS — Étape 10 : Notifications temps réel
# ============================================================
echo "🚀 Création des notifications..."

mkdir -p src/components/notifications
mkdir -p src/hooks

# ============================================================
# 1. Hook useNotifications
# ============================================================
cat > src/hooks/useNotifications.ts << 'EOF'
"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  data: any
  is_read: boolean
  created_at: string
}

export function useNotifications(userId: string) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef<any>(null)

  // Charger les notifications initiales
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Realtime — nouvelles notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Notification
          setNotifications(prev => [notif, ...prev])
          setUnreadCount(prev => prev + 1)

          // Notification navigateur
          if (Notification.permission === "granted") {
            new Notification(notif.title, {
              body: notif.body ?? undefined,
              icon: "/favicon.ico",
            })
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
          )
          setUnreadCount(prev => payload.new.is_read ? Math.max(0, prev - 1) : prev)
        }
      )
      .subscribe()

    channelRef.current = channel

    // Demander permission notifications navigateur
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Marquer une notification comme lue
  const markAsRead = async (notifId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notifId)
  }

  // Tout marquer comme lu
  const markAllAsRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
EOF
echo "✓ hooks/useNotifications.ts"

# ============================================================
# 2. NotificationBell — cloche dans la sidebar
# ============================================================
cat > src/components/notifications/NotificationBell.tsx << 'EOF'
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, CheckCheck, MessageSquare, Heart, AtSign, X } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface NotificationBellProps {
  userId: string
}

const ICONS: Record<string, any> = {
  new_message: MessageSquare,
  mention: AtSign,
  reaction: Heart,
  default: Bell,
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleNotifClick = async (notif: any) => {
    await markAsRead(notif.id)
    setOpen(false)

    // Navigation selon le type
    if (notif.type === "new_message" && notif.data?.conversation_id) {
      router.push(`/messages/${notif.data.conversation_id}`)
    } else if (notif.type === "story_view" && notif.data?.story_id) {
      router.push("/stories")
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "relative w-8 h-8 flex items-center justify-center rounded-full transition-colors",
          open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-10 left-0 w-80 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Bell className="w-8 h-8 opacity-20" />
                <p className="text-xs">Aucune notification</p>
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = ICONS[notif.type] ?? ICONS.default
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0",
                      !notif.is_read && "bg-primary/5"
                    )}
                  >
                    {/* Icône */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      !notif.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-snug", !notif.is_read ? "font-medium" : "text-muted-foreground")}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>

                    {/* Point non lu */}
                    {!notif.is_read && (
                      <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
EOF
echo "✓ NotificationBell.tsx"

# ============================================================
# 3. Mettre à jour Sidebar pour inclure NotificationBell
# ============================================================
cat > src/components/layout/Sidebar.tsx << 'EOF'
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, BookOpen, Users, Phone, Settings, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import NotificationBell from "@/components/notifications/NotificationBell"

const NAV_ITEMS = [
  { href: "/messages",    icon: MessageSquare, label: "Messages" },
  { href: "/stories",     icon: BookOpen,      label: "Stories" },
  { href: "/communities", icon: Users,         label: "Communautés" },
  { href: "/calls",       icon: Phone,         label: "Appels" },
  { href: "/settings",    icon: Settings,      label: "Réglages" },
]

interface SidebarProps {
  profile: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    status: string | null
  }
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Profil + cloche */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {(profile.display_name ?? profile.username ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate leading-tight">
            {profile.display_name ?? profile.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
        </div>
        {/* Cloche notifications */}
        <NotificationBell userId={profile.id} />
      </div>

      {/* Recherche */}
      <div className="px-3 py-2 shrink-0">
        <Link
          href="/search"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground flex-1">Rechercher…</span>
          <kbd className="text-[10px] text-muted-foreground/60 bg-background/60 border border-border rounded px-1.5 py-0.5 hidden group-hover:block">
            ⌘K
          </kbd>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active && "stroke-[2.5px]")} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
EOF
echo "✓ Sidebar.tsx mis à jour"

# ============================================================
# 4. Trigger SQL — créer notif automatiquement sur nouveau message
# ============================================================
cat > /tmp/notifications_trigger.sql << 'SQL'
-- Fonction : créer une notification quand un message est envoyé
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  -- Récupérer le nom de l'expéditeur
  SELECT COALESCE(display_name, username, 'Quelqu''un')
  INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Notifier tous les membres sauf l'expéditeur
  FOR recipient_id IN
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      recipient_id,
      'new_message',
      sender_name || ' vous a envoyé un message',
      LEFT(COALESCE(NEW.content, '📎 Fichier'), 100),
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
SQL

echo ""
echo "✅ Notifications créées !"
echo ""
echo "📋 ÉTAPE MANUELLE — Exécute ce SQL dans Supabase SQL Editor :"
echo "   (contenu dans /tmp/notifications_trigger.sql)"
echo ""
cat /tmp/notifications_trigger.sql
echo ""
echo "👉 Puis lance : rm -rf .next && pnpm dev"
