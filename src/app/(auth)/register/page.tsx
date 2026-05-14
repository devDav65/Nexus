'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const registerSchema = z.object({
  username: z.string().min(3, 'Minimum 3 caractères').max(20).regex(/^[a-z0-9_]+$/, 'Lettres minuscules, chiffres et _ uniquement'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})
type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    setError(null)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { username: data.username, full_name: data.username },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (signUpError) { setError(signUpError.message); return }
    if (authData.user && !authData.session) { setSuccess(true); return }
    router.push('/messages')
    router.refresh()
  }

  if (success) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">✉️</div>
        <h2 className="text-xl font-semibold mb-2">Vérifie tes emails</h2>
        <p className="text-muted-foreground text-sm">
          Un lien de confirmation a été envoyé à ton adresse.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-xl p-8 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">Créer un compte</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input id="username" placeholder="ton_pseudo" {...register('username')} />
          {errors.username && <p className="text-destructive text-xs mt-1">{errors.username.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="toi@exemple.com" {...register('email')} />
          {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" placeholder="8 caractères minimum" {...register('password')} />
          {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>
        {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Création...' : 'Créer mon compte'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">Se connecter</Link>
      </p>
    </div>
  )
}
