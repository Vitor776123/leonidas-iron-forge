import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Leonidas" },
      { name: "description", content: "Acesse seu treino personalizado no Leonidas." },
      { property: "og:title", content: "Entrar — Leonidas" },
      {
        property: "og:description",
        content: "Acesse seu treino personalizado no Leonidas.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else toast.success("Confira seu e-mail para confirmar o cadastro.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-in flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-sm bg-primary shadow-[var(--shadow-blood)]">
            <Dumbbell className="size-9 text-primary-foreground" strokeWidth={2.75} />
          </span>
          <h1 className="font-display text-5xl tracking-[0.18em]">LEONIDAS</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Treino sem desculpa
          </p>
        </div>

        <form
          onSubmit={submit}
          className="surface-iron space-y-5 rounded-sm border border-border p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full font-display text-lg tracking-widest"
          >
            {busy ? "..." : mode === "login" ? "ENTRAR" : "CRIAR CONTA"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            {mode === "login" ? "Criar uma conta" : "Já tenho conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
