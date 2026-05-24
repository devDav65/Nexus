import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"
import GlobalCallProvider from "@/components/calls/GlobalCallProvider"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, status")
    .eq("id", user.id)
    .single()

  if (!profile?.username) redirect("/onboarding")

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 lg:w-72 flex-col border-r border-border shrink-0 overflow-hidden">
        <Sidebar profile={profile} />
      </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
        <BottomNav />
      </nav>

      {/* Sonnerie + écran appel global */}
      <GlobalCallProvider currentUserId={user.id} />
    </div>
  )
}
