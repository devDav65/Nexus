import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Nexus</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Ta plateforme de communication
                    </p>
                </div>
                {children}
            </div>
        </div>
    )
}