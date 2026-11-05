import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { perfilEstaCompleto } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReenviarBotao } from "@/components/ReenviarBotao";

// Captura o retorno do link do e-mail antes do cliente limpar a URL.
type Retorno = "sucesso" | "erro" | null;
function capturarRetorno(): Retorno {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  const get = (k: string) => hash.get(k) ?? search.get(k);
  if (get("error") || get("error_code")) return "erro";
  const type = get("type");
  if (get("access_token") && (type === "signup" || type === "email")) return "sucesso";
  if (search.get("code") && type === "signup") return "sucesso";
  return null;
}
const RETORNO_INICIAL: Retorno = capturarRetorno();
let retornoConsumido = false;

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leonidas — Treino sem desculpa" },
      { name: "description", content: "Seu treino personalizado, dia a dia, no Leonidas." },
      { property: "og:title", content: "Leonidas — Treino sem desculpa" },
      { property: "og:description", content: "Seu treino personalizado, dia a dia, no Leonidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function limparUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [retorno] = useState<Retorno>(() => (retornoConsumido ? null : RETORNO_INICIAL));
  const [falhou, setFalhou] = useState(retorno === "erro");
  const [destino, setDestino] = useState<"/questionario" | "/treino" | null>(null);

  useEffect(() => {
    retornoConsumido = true;
    if (retorno) {
      const t = setTimeout(limparUrl, 1500);
      return () => clearTimeout(t);
    }
  }, [retorno]);

  useEffect(() => {
    if (falhou || loading) return;
    if (!user) {
      if (retorno === "sucesso") {
        // sessão pode demorar; se não vier, mostra erro
        const t = setTimeout(() => setFalhou(true), 6000);
        return () => clearTimeout(t);
      }
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase
      .from("profiles")
      .select("id, idade, altura_cm, peso_kg, objetivo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // Em caso de erro de leitura, nunca reabrir o onboarding.
        const alvo = error
          ? "/treino"
          : !data || !perfilEstaCompleto(data as Record<string, unknown>)
            ? "/questionario"
            : "/treino";
        if (retorno === "sucesso") setDestino(alvo);
        else navigate({ to: alvo, replace: true });
      }, () => {
        if (retorno === "sucesso") setDestino("/questionario");
        else setFalhou(true);
      });
  }, [user, loading, navigate, retorno, falhou]);

  if (falhou) return <TelaErro />;

  if (retorno === "sucesso" && destino) {
    return (
      <Tela>
        <CheckCircle2 className="mx-auto size-16 text-gold" />
        <h1 className="mt-6 font-display text-4xl tracking-wide">CONTA CRIADA COM SUCESSO!</h1>
        <p className="mt-3 text-muted-foreground">
          Seu e-mail foi confirmado. Vamos montar o seu treino.
        </p>
        <Button
          className="mt-8 h-12 w-full font-display text-lg tracking-widest"
          onClick={() => {
            limparUrl();
            navigate({ to: destino, replace: true });
          }}
        >
          COMEÇAR
        </Button>
      </Tela>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="font-display text-3xl tracking-[0.3em] text-muted-foreground">LEONIDAS</span>
    </div>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen-in flex min-h-screen items-center justify-center px-4">
      <div className="surface-iron w-full max-w-sm rounded-sm border border-border p-6 text-center">
        {children}
      </div>
    </div>
  );
}

function TelaErro() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [mostrarCampo, setMostrarCampo] = useState(false);
  return (
    <Tela>
      <AlertTriangle className="mx-auto size-14 text-primary" />
      <h1 className="mt-5 font-display text-3xl tracking-wide">Não foi possível confirmar</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Este link expirou ou já foi usado. Se você já confirmou seu e-mail, é só entrar com sua
        senha.
      </p>
      <div className="mt-6 space-y-3">
        <Button
          className="h-12 w-full font-display text-lg tracking-widest"
          onClick={() => {
            limparUrl();
            navigate({ to: "/auth", replace: true });
          }}
        >
          IR PARA O LOGIN
        </Button>
        {mostrarCampo ? (
          <>
            <Input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
            <ReenviarBotao email={email} label="REENVIAR E-MAIL DE CONFIRMAÇÃO" />
          </>
        ) : (
          <Button
            variant="secondary"
            className="h-12 w-full font-display text-sm tracking-widest"
            onClick={() => setMostrarCampo(true)}
          >
            REENVIAR E-MAIL DE CONFIRMAÇÃO
          </Button>
        )}
      </div>
    </Tela>
  );
}
