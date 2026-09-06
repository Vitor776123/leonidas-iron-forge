import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import helmetAsset from "@/assets/leonidas_helmet.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite — Leonidas" },
      {
        name: "description",
        content: "Aceite o convite do seu professor e comece a treinar no Leonidas.",
      },
      { property: "og:title", content: "Convite — Leonidas" },
      {
        property: "og:description",
        content: "Aceite o convite do seu professor e comece a treinar no Leonidas.",
      },
    ],
  }),
  component: ConvitePage,
});

type Estado =
  | { fase: "validando" }
  | { fase: "invalido"; motivo: string }
  | { fase: "ok"; email: string; academia: string | null };

function ConvitePage() {
  const { token } = useParams({ from: "/convite/$token" });
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>({ fase: "validando" });
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validar-convite", {
          body: { token },
        });
        if (error) throw error;
        const resp = data as
          | { valido?: boolean; email?: string; academia?: string | null; error?: string }
          | null;
        if (!ativo) return;
        if (!resp?.valido) {
          setEstado({
            fase: "invalido",
            motivo: resp?.error ?? "Convite inválido ou expirado.",
          });
          return;
        }
        setEstado({
          fase: "ok",
          email: resp.email ?? "",
          academia: resp.academia ?? null,
        });
      } catch (err) {
        if (!ativo) return;
        setEstado({
          fase: "invalido",
          motivo: err instanceof Error ? err.message : "Convite inválido ou expirado.",
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  async function aceitar() {
    if (estado.fase !== "ok" || !nome.trim() || senha.length < 6) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("aceitar-convite", {
        body: { token, nome: nome.trim(), senha },
      });
      if (error) throw error;
      const resp = data as { ok?: boolean; error?: string } | null;
      if (resp?.error || !resp?.ok) throw new Error(resp?.error ?? "Falha ao aceitar convite");

      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: estado.email,
        password: senha,
      });
      if (loginErr) throw loginErr;
      navigate({ to: "/questionario", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao aceitar convite";
      const m = msg.toLowerCase();
      toast.error(
        m.includes("limite")
          ? "Limite de alunos atingido para esta academia. Fale com seu professor."
          : msg,
      );
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
            alt="Leonidas"
            className="mx-auto mb-5 size-16 object-contain"
          />
          <h1 className="font-display text-4xl tracking-[0.18em]">CONVITE</h1>
          {estado.fase === "ok" && (
            <p className="mt-2 text-sm uppercase tracking-[0.25em] text-muted-foreground">
              {estado.academia ?? "Sua academia"}
            </p>
          )}
        </div>

        {estado.fase === "validando" && (
          <p className="text-center text-sm text-muted-foreground">Validando convite…</p>
        )}

        {estado.fase === "invalido" && (
          <div className="surface-iron rounded-sm border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">{estado.motivo}</p>
            <Button
              className="mt-5 h-12 w-full font-display tracking-widest"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              IR PARA O LOGIN
            </Button>
          </div>
        )}

        {estado.fase === "ok" && (
          <div className="surface-iron space-y-5 rounded-sm border border-border p-6">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={estado.email} readOnly disabled className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Crie uma senha</Label>
              <Input
                id="senha"
                type="password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button
              onClick={aceitar}
              disabled={busy || !nome.trim() || senha.length < 6}
              className="h-12 w-full font-display text-lg tracking-widest"
            >
              {busy ? "..." : "ACEITAR CONVITE"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
