import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const { userId } = await request.json()
        if (!userId) return NextResponse.json({ ok: false })

        const supabase = await createClient()
        await supabase
            .from("profiles")
            .update({ status: "offline", last_seen_at: new Date().toISOString() })
            .eq("id", userId)

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false })
    }
}
