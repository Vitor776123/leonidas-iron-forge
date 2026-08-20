import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { supabase, type Profile } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Perfil — Leonidas" },
      { name: "description", content: "Seus dados e configurações do treino Leonidas." },
      { property: "og:title", content: "Perfil — Leonidas" },
      {
        property: "og:description",
        content: "Seus dados e configurações do treino Leonidas.",
      },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  return (
    <AppShell>
      <h1 className="text-4xl">Perfil</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {user?.email}
      </p>

      {profile && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Info label="Nome" value={profile.nome} />
          <Info label="Idade" value={`${profile.idade} anos`} />
          <Info label="Altura" value={`${profile.altura_cm} cm`} />
          <Info label="Peso" value={`${profile.peso_kg} kg`} />
          <Info label="IMC" value={profile.imc ? String(profile.imc) : "—"} />
          <Info label="Gênero" value={profile.genero} />
          <Info label="Dias / semana" value={String(profile.dias_por_semana)} />
          <Info label="Tempo de treino" value={`${profile.tempo_treino_meses} meses`} />
          <Info label="Categoria" value={profile.categoria} gold />
          <Info label="Objetivo" value={profile.objetivo} />
          <Info
            label="Foco"
            value={profile.foco_grupo_customizado || profile.foco}
            gold
          />
        </div>
      )}

      <div className="surface-iron mt-10 rounded-sm border border-border p-6">
        <h2 className="text-2xl">Refazer questionário</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gera um plano novo do zero. O plano anterior é desativado automaticamente.
        </p>
        <Button
          className="mt-5 h-12 w-full font-display text-lg tracking-widest sm:w-auto"
          onClick={() => navigate({ to: "/questionario" })}
        >
          <RefreshCw className="mr-1 size-5" /> REFAZER
        </Button>
      </div>
    </AppShell>
  );
}

function Info({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="surface-iron rounded-sm border border-border p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl ${gold ? "text-gold" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
