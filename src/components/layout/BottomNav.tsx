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
