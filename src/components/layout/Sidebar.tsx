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
