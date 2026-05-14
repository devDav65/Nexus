#!/bin/bash
# ============================================================
# NEXUS — Création automatique de tous les fichiers étapes 4-6
# Exécuter depuis la racine du projet : bash setup_nexus.sh
# ============================================================

echo "🚀 Création des dossiers..."
mkdir -p src/app/\(auth\)/onboarding
mkdir -p src/app/\(app\)/messages
mkdir -p src/components/layout
mkdir -p src/components/ui
mkdir -p src/hooks

echo "📁 Dossiers créés ✓"

# ============================================================
# ÉTAPE 4 — useDebounce hook
# ============================================================
cat > src/hooks/useDebounce.ts << 'EOF'
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
EOF
echo "✓ src/hooks/useDebounce.ts"

# ============================================================
# ÉTAPE 4 — Onboarding page
# ============================================================
cat > src/app/\(auth\)/onboarding/page.tsx << 'EOF'
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { z } from "zod";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, MessageSquare } from "lucide-react";

const usernameSchema = z
  .string()
  .min(3, "Minimum 3 caractères")
  .max(30, "Maximum 30 caractères")
  .regex(/^[a-z0-9_]+$/, "Lettres minuscules, chiffres et _ uniquement");

type CheckStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const debouncedUsername = useDebounce(username, 450);

  useEffect(() => {
    if (!debouncedUsername) { setStatus("idle"); return; }

    const parsed = usernameSchema.safeParse(debouncedUsername);
    if (!parsed.success) {
      setStatus("invalid");
      setErrorMsg(parsed.error.errors[0].message);
      return;
    }

    setStatus("checking");
    setErrorMsg("");

    supabase
      .from("profiles")
      .select("username")
      .eq("username", debouncedUsername)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setStatus("idle"); return; }
        setStatus(data ? "taken" : "available");
      });
  }, [debouncedUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "available" || saving) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { router.push("/login"); return; }

    const { error } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase() })
      .eq("id", user.id);

    if (error) {
      setErrorMsg("Erreur lors de la sauvegarde. Réessayez.");
      setSaving(false);
      return;
    }

    router.push("/messages");
  };

  const statusIcon = {
    idle: null,
    checking: <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />,
    available: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    taken: <XCircle className="w-4 h-4 text-destructive" />,
    invalid: <XCircle className="w-4 h-4 text-destructive" />,
  }[status];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Choisissez votre @handle</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Les autres vous trouveront avec cet identifiant unique
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">
              @
            </span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="votrehandle"
              className="pl-7 pr-10 h-11"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
            />
            {statusIcon && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {statusIcon}
              </span>
            )}
          </div>

          {status === "available" && (
            <p className="text-sm text-green-600 dark:text-green-400">@{username} est disponible ✓</p>
          )}
          {status === "taken" && (
            <p className="text-sm text-destructive">@{username} est déjà pris</p>
          )}
          {(status === "invalid" || errorMsg) && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <ul className="text-xs text-muted-foreground space-y-1 pl-1">
            <li className={username.length >= 3 ? "text-green-600 dark:text-green-400" : ""}>
              • 3 à 30 caractères
            </li>
            <li className={/^[a-z0-9_]*$/.test(username) && username ? "text-green-600 dark:text-green-400" : ""}>
              • Lettres minuscules, chiffres, underscores uniquement
            </li>
          </ul>

          <Button type="submit" disabled={status !== "available" || saving} className="w-full h-11">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Continuer
          </Button>
        </form>
      </div>
    </div>
  );
}
EOF
echo "✓ src/app/(auth)/onboarding/page.tsx"

# ============================================================
# ÉTAPE 4 — Middleware mis à jour
# ============================================================
cat > src/middleware.ts << 'EOF'
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback", "/onboarding"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Non connecté → login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Connecté → vérifier username
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (!profile?.username && !path.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Connecté avec username → pas besoin de rester sur login/register
  if (user && (path === "/login" || path === "/register")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profile?.username) {
      return NextResponse.redirect(new URL("/messages", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
EOF
echo "✓ src/middleware.ts"

# ============================================================
# ÉTAPE 5 — App layout
# ============================================================
cat > src/app/\(app\)/layout.tsx << 'EOF'
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, status")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/onboarding");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 lg:w-72 flex-col border-r border-border shrink-0 overflow-hidden">
        <Sidebar profile={profile} />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
        <BottomNav />
      </nav>
    </div>
  );
}
EOF
echo "✓ src/app/(app)/layout.tsx"

# ============================================================
# ÉTAPE 5 — Sidebar
# ============================================================
cat > src/components/layout/Sidebar.tsx << 'EOF'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, BookOpen, Users, Phone, Settings, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/messages",    icon: MessageSquare, label: "Messages" },
  { href: "/stories",     icon: BookOpen,      label: "Stories" },
  { href: "/communities", icon: Users,         label: "Communautés" },
  { href: "/calls",       icon: Phone,         label: "Appels" },
  { href: "/settings",    icon: Settings,      label: "Réglages" },
];

interface SidebarProps {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    status: string | null;
  };
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-background">
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
      </div>

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

      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
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
          );
        })}
      </nav>
    </div>
  );
}
EOF
echo "✓ src/components/layout/Sidebar.tsx"

# ============================================================
# ÉTAPE 5 — BottomNav
# ============================================================
cat > src/components/layout/BottomNav.tsx << 'EOF'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, BookOpen, Users, Phone, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/messages",    icon: MessageSquare, label: "Chats" },
  { href: "/stories",     icon: BookOpen,      label: "Stories" },
  { href: "/communities", icon: Users,         label: "Groupes" },
  { href: "/calls",       icon: Phone,         label: "Appels" },
  { href: "/settings",    icon: Settings,      label: "Réglages" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-stretch h-16 px-1">
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 gap-1 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5 transition-all", active ? "stroke-[2.5px] scale-110" : "stroke-[1.75px]")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
EOF
echo "✓ src/components/layout/BottomNav.tsx"

# ============================================================
# ÉTAPE 6 — Messages page (Server Component)
# ============================================================
cat > src/app/\(app\)/messages/page.tsx << 'EOF'
import { createClient } from "@/lib/supabase/server";
import MessagesListClient from "./MessagesListClient";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select(`
      last_read_at,
      is_muted,
      conversation:conversations (
        id, type, name, avatar_url, last_message_at, last_message_preview,
        members:conversation_members (
          user_id,
          profile:profiles ( id, username, display_name, avatar_url, status )
        )
      )
    `)
    .eq("user_id", user!.id)
    .order("conversation(last_message_at)", { ascending: false })
    .limit(40);

  return (
    <MessagesListClient
      initialConversations={memberships ?? []}
      currentUserId={user!.id}
    />
  );
}
EOF
echo "✓ src/app/(app)/messages/page.tsx"

# ============================================================
# ÉTAPE 6 — MessagesListClient
# ============================================================
cat > src/app/\(app\)/messages/MessagesListClient.tsx << 'EOF'
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  initialConversations: any[];
  currentUserId: string;
}

export default function MessagesListClient({ initialConversations, currentUserId }: Props) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [query, setQuery] = useState("");

  const refetch = async () => {
    const { data } = await supabase
      .from("conversation_members")
      .select(`
        last_read_at, is_muted,
        conversation:conversations (
          id, type, name, avatar_url, last_message_at, last_message_preview,
          members:conversation_members (
            user_id,
            profile:profiles ( id, username, display_name, avatar_url, status )
          )
        )
      `)
      .eq("user_id", currentUserId)
      .order("conversation(last_message_at)", { ascending: false })
      .limit(40);
    if (data) setConversations(data);
  };

  useEffect(() => {
    const channel = supabase
      .channel("messages-list")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const filtered = conversations.filter((item) => {
    const conv = item.conversation;
    if (!conv) return false;
    const search = query.toLowerCase();
    if (!search) return true;
    if (conv.name?.toLowerCase().includes(search)) return true;
    if (conv.last_message_preview?.toLowerCase().includes(search)) return true;
    return conv.members?.some((m: any) =>
      m.profile?.display_name?.toLowerCase().includes(search) ||
      m.profile?.username?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Messages</h1>
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
            <Edit3 className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="pl-8 h-9 bg-muted/50 border-transparent focus:border-input text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {filtered.length === 0 && query ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">Aucun résultat pour « {query} »</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 text-muted-foreground px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <p className="text-sm">Aucune conversation pour l'instant</p>
            <p className="text-xs">Recherchez un @username pour démarrer</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/search">Trouver des contacts</Link>
            </Button>
          </div>
        ) : (
          filtered.map((item) => (
            <ConversationRow key={item.conversation?.id} item={item} currentUserId={currentUserId} />
          ))
        )}
      </div>

      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <Button asChild size="icon" className="w-12 h-12 rounded-full shadow-lg">
          <Link href="/search"><Edit3 className="w-5 h-5" /></Link>
        </Button>
      </div>
    </div>
  );
}

function ConversationRow({ item, currentUserId }: { item: any; currentUserId: string }) {
  const conv = item.conversation;
  if (!conv) return null;

  const isDM = conv.type === "direct";
  const otherMember = isDM ? conv.members?.find((m: any) => m.user_id !== currentUserId) : null;
  const displayName = isDM
    ? otherMember?.profile?.display_name ?? `@${otherMember?.profile?.username}` ?? "Contact"
    : conv.name ?? "Groupe";
  const avatarUrl = isDM ? otherMember?.profile?.avatar_url : conv.avatar_url;
  const isOnline = otherMember?.profile?.status === "online";
  const initials = displayName.charAt(0).toUpperCase();

  const lastRead = new Date(item.last_read_at ?? 0);
  const lastMsg = conv.last_message_at ? new Date(conv.last_message_at) : null;
  const hasUnread = !item.is_muted && lastMsg && lastMsg > lastRead;

  return (
    <Link
      href={`/messages/${conv.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="relative shrink-0">
        <Avatar className="w-12 h-12">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isDM && isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className={cn("text-sm truncate", hasUnread ? "font-semibold text-foreground" : "font-medium")}>
            {displayName}
          </p>
          {lastMsg && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatDistanceToNow(lastMsg, { addSuffix: false, locale: fr })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-xs truncate", hasUnread ? "text-foreground" : "text-muted-foreground")}>
            {conv.last_message_preview ?? "Nouvelle conversation"}
          </p>
          {hasUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
        </div>
      </div>
    </Link>
  );
}
EOF
echo "✓ src/app/(app)/messages/MessagesListClient.tsx"

# ============================================================
# ÉTAPE 6 — Skeletons
# ============================================================
cat > src/components/ui/skeletons.tsx << 'EOF'
import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-md", className)} />;
}

export function SkeletonConversation() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <Skeleton className="h-2.5 w-44" />
      </div>
    </div>
  );
}

export function SkeletonMessage({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={cn("flex items-end gap-2 mb-1", isOwn && "flex-row-reverse")}>
      {!isOwn && <Skeleton className="w-7 h-7 rounded-full shrink-0" />}
      <Skeleton className={cn("h-9 rounded-2xl", isOwn ? "w-36 rounded-br-sm" : "w-48 rounded-bl-sm")} />
    </div>
  );
}
EOF
echo "✓ src/components/ui/skeletons.tsx"

# ============================================================
# ÉTAPE 6 — Auth callback mis à jour
# ============================================================
cat > src/app/auth/callback/route.ts << 'EOF'
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/messages";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (!profile?.username) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
EOF
echo "✓ src/app/auth/callback/route.ts"

echo ""
echo "✅ Tous les fichiers ont été créés !"
echo ""
echo "👉 Prochaine étape :"
echo "   pnpm add date-fns"
echo "   pnpx shadcn@latest add avatar"
echo "   pnpm dev"