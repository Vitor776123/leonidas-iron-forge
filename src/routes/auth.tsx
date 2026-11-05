import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import helmetAsset from "@/assets/leonidas_helmet.png.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReenviarBotao } from "@/components/ReenviarBotao";
import { traduzErroAuth } from "@/lib/auth-mensagens";

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
  const [aguardando, setAguardando] = useState<string | null>(null);
  const [naoConfirmado, setNaoConfirmado] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNaoConfirmado(false);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) {
          if (error.message?.toLowerCase().includes("email not confirmed")) setNaoConfirmado(true);
          throw error;
        }
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else if (data.user && (data.user.identities ?? []).length === 0) {
          toast.error("Este e-mail já tem uma conta. Entre com sua senha.");
          setMode("login");
        } else setAguardando(email);
      }
    } catch (err) {
      const m = traduzErroAuth(err);
      if (m.startsWith("Este e-mail já tem")) setMode("login");
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-in flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img
            src={helmetAsset.url}
            alt="Elmo Leonidas"
            className="mx-auto mb-5 size-16 object-contain"
          />
          <h1 className="font-display text-5xl tracking-[0.18em]">LEONIDAS</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Treino sem desculpa
          </p>
        </div>

        {aguardando ? (
          <div className="surface-iron space-y-4 rounded-sm border border-border p-6 text-center">
            <h2 className="font-display text-3xl tracking-wide">Quase lá!</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <span className="text-gold">{aguardando}</span>.
              Abra o e-mail e toque no link para ativar sua conta. Se não encontrar, olhe a caixa de
              spam.
            </p>
            <ReenviarBotao email={aguardando} iniciarEspera />
            <Button
              className="h-12 w-full font-display text-lg tracking-widest"
              onClick={() => {
                setAguardando(null);
                setMode("login");
              }}
            >
              VOLTAR AO LOGIN
            </Button>
          </div>
        ) : (
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
            {naoConfirmado && mode === "login" && (
              <ReenviarBotao email={email} label="Reenviar e-mail de confirmação" />
            )}
          </form>
        )}
      </div>
    </div>
  );
}
