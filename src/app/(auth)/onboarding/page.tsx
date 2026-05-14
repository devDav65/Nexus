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
      setErrorMsg(parsed.error?.errors?.[0]?.message ?? "Format invalide");
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
