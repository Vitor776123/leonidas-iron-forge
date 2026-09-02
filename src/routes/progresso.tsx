import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Flame, Scale, StickyNote, Timer, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/progresso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Progresso — Leonidas" },
      { name: "description", content: "Sua evolução: sequência de dias, constância e distribuição muscular." },
      { property: "og:title", content: "Progresso — Leonidas" },
      { property: "og:description", content: "Sua evolução: sequência de dias, constância e distribuição muscular." },
    ],
  }),
  component: ProgressoPage,
});

type Periodo = "semana" | "mes" | "trimestre" | "semestre" | "ano";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "ano", label: "Ano" },
];

type Distribuicao = { muscle: string; total_exercicios: number; percentual: number };
type DiaCalendario = { data: string; treinos: number };

type Overview = {
  periodo: string;
  total_treinos: number;
  total_treinos_periodo_anterior: number;
  sequencia_atual_dias: number;
  distribuicao_muscular: Distribuicao[];
  calendario: DiaCalendario[];
  calorias_queimadas_cardio?: number | null;
  minutos_cardio_total?: number | null;
};

type Observacao = {
  exercicio_nome: string;
  muscle: string | null;
  observacao: string;
  atualizado_em: string;
  dia_rotulo: string | null;
};

const MUSCULOS: Record<string, string> = {
  pectorals: "Peitorais",
  quads: "Quadríceps",
  lats: "Dorsais",
  delts: "Ombros",
  "upper-back": "Costas Superior",
  hamstrings: "Posterior de Coxa",
  glutes: "Glúteos",
  calves: "Panturrilhas",
  biceps: "Bíceps",
  triceps: "Tríceps",
  traps: "Trapézio",
  abs: "Abdômen",
  forearms: "Antebraços",
  abductors: "Abdutores",
  adductors: "Adutores",
};

function musculo(codigo: string | null | undefined) {
  if (!codigo) return "—";
  return MUSCULOS[codigo] ?? codigo;
}

function dataAmigavel(iso: string) {
  const d = new Date(iso);
  const agora = new Date();
  const inicio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicio(agora) - inicio(d)) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: dias > 365 ? "numeric" : undefined });
}

function ProgressoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("semana");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data: profileId } = useQuery({
    queryKey: ["profile-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id as string | null;
    },
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ["progresso", profileId, periodo],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_progress_overview", {
        p_profile_id: profileId,
        p_periodo: periodo,
      });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const { data: observacoes } = useQuery({
    queryKey: ["observacoes", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_observacoes", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Observacao[];
    },
  });

  const { data: resumoPerfil } = useQuery({
    queryKey: ["perfil-resumo", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_perfil_resumo", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      return data as unknown as PerfilResumo;
    },
  });

  const ultimoTreino = resumoPerfil?.ultimo_treino;

  const diasComTreino = useMemo(
    () => new Map((overview?.calendario ?? []).map((d) => [d.data, d.treinos])),
    [overview],
  );

  const diff =
    (overview?.total_treinos ?? 0) - (overview?.total_treinos_periodo_anterior ?? 0);

  return (
    <AppShell>
      <h1 className="text-4xl">Progresso</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        Sua evolução em números
      </p>

      <div className="mt-6 grid grid-cols-5 gap-1 rounded-sm border border-border bg-card p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`min-h-[44px] rounded-sm font-display text-xs uppercase tracking-widest transition-colors ${
              periodo === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground active:bg-secondary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="mt-10 text-center text-sm text-muted-foreground">Carregando…</p>
      )}

      {overview && (
        <div className="mt-6 space-y-6">
          {/* Sequência + total */}
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-iron rounded-sm border border-border p-5 text-center">
              <Flame className="mx-auto size-7 text-primary" strokeWidth={2.5} />
              <p className="mt-2 font-display text-5xl leading-none text-gradient-gold">
                {overview.sequencia_atual_dias}
              </p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                dias seguidos
              </p>
            </div>
            <div className="surface-iron rounded-sm border border-border p-5 text-center">
              <Dumbbell className="mx-auto size-7 text-primary" strokeWidth={2.5} />
              <p className="mt-2 font-display text-5xl leading-none text-foreground">
                {overview.total_treinos}
              </p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                treinos no período
              </p>
              <p className="mt-2 flex items-center justify-center gap-1 text-xs">
                {diff > 0 ? (
                  <>
                    <TrendingUp className="size-4 text-gold" />
                    <span className="text-gold">+{diff} que o período anterior</span>
                  </>
                ) : diff < 0 ? (
                  <>
                    <TrendingDown className="size-4 text-destructive" />
                    <span className="text-destructive">{diff} que o período anterior</span>
                  </>
                ) : (
                  <>
                    <Minus className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">igual ao período anterior</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Constância */}
          <ConstanciaCard
            periodo={periodo}
            calendario={overview.calendario ?? []}
            ultimoTreino={ultimoTreino ?? null}
          />


          {/* Distribuição muscular */}
          <div className="surface-iron rounded-sm border border-border p-5">
            <h2 className="text-xl">Distribuição muscular</h2>
            {overview.distribuicao_muscular?.length ? (
              <div className="mt-4 space-y-3">
                {overview.distribuicao_muscular.map((d) => (
                  <div key={d.muscle}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{musculo(d.muscle)}</span>
                      <span className="font-display text-gold">{d.percentual}%</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-sm bg-secondary/60">
                      <div
                        className="h-full rounded-sm bg-[image:var(--gradient-blood)] transition-[width] duration-500"
                        style={{ width: `${Math.min(100, d.percentual)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Sem dados de distribuição neste período.
              </p>
            )}
          </div>

          {/* Cardio */}
          <div className="surface-iron rounded-sm border border-border p-5">
            <h2 className="text-xl">Cardio</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-sm border border-border bg-card p-4 text-center">
                <Flame className="mx-auto size-6 text-primary" strokeWidth={2.5} />
                <p className="mt-2 font-display text-4xl leading-none text-gradient-gold">
                  {overview.calorias_queimadas_cardio ?? 0}
                </p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  kcal queimadas
                </p>
              </div>
              <div className="rounded-sm border border-border bg-card p-4 text-center">
                <Timer className="mx-auto size-6 text-gold" strokeWidth={2.5} />
                <p className="mt-2 font-display text-4xl leading-none text-foreground">
                  {overview.minutos_cardio_total ?? 0}
                </p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  minutos de cardio
                </p>
              </div>
            </div>
          </div>

          {/* Peso corporal */}
          <PesoCard profileId={profileId!} />

          {/* Observações de treino */}
          <div className="surface-iron rounded-sm border border-border p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <StickyNote className="size-5 text-gold" /> Observações de treino
            </h2>
            {observacoes && observacoes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {observacoes.map((o, i) => (
                  <div key={i} className="rounded-sm border border-border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-lg uppercase tracking-wide">
                        {o.exercicio_nome}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {dataAmigavel(o.atualizado_em)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      {musculo(o.muscle)}
                      {o.dia_rotulo ? ` · ${o.dia_rotulo}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-foreground/90">{o.observacao}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma observação registrada ainda — suas anotações nos exercícios vão
                aparecer aqui.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

type PerfilResumo = {
  ultimo_treino?: { rotulo: string | null; completed_at: string } | null;
  ultima_pesagem?: {
    peso_kg: number;
    registrado_em: string;
    dias_desde_ultima: number | null;
  } | null;
  historico_peso?: { peso_kg: number; registrado_em: string }[] | null;
};

function PesoCard({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const [peso, setPeso] = useState("");

  const { data: resumo } = useQuery({
    queryKey: ["perfil-resumo", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_perfil_resumo", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      return data as unknown as PerfilResumo;
    },
  });

  const salvar = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase
        .from("peso_registros")
        .insert({ profile_id: profileId, peso_kg: valor });
      if (error) throw error;
    },
    onSuccess: () => {
      setPeso("");
      toast.success("Peso registrado");
      qc.invalidateQueries({ queryKey: ["perfil-resumo", profileId] });
    },
    onError: () => toast.error("Não foi possível registrar o peso"),
  });

  const pontos = useMemo(
    () =>
      [...(resumo?.historico_peso ?? [])]
        .map((p) => ({ t: new Date(p.registrado_em).getTime(), peso: Number(p.peso_kg) }))
        .sort((a, b) => a.t - b.t),
    [resumo],
  );

  const ultima = resumo?.ultima_pesagem;

  function enviar() {
    const valor = Number(peso.replace(",", "."));
    if (!valor || valor <= 0) {
      toast.error("Informe um peso válido");
      return;
    }
    salvar.mutate(valor);
  }

  return (
    <div className="surface-iron rounded-sm border border-border p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <Scale className="size-5 text-gold" /> Peso corporal
      </h2>

      <div className="mt-4 flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="78.5"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          className="h-12 text-lg"
        />
        <Button
          onClick={enviar}
          disabled={salvar.isPending}
          className="h-12 shrink-0 font-display tracking-widest"
        >
          SALVAR
        </Button>
      </div>

      {ultima ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Última pesagem:{" "}
          <span className="font-display text-lg text-gold">{ultima.peso_kg} kg</span>{" "}
          — {dataAmigavel(ultima.registrado_em)}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma pesagem registrada.</p>
      )}

      {pontos.length > 0 && (
        <div className="mt-5 -mx-1 overflow-x-auto pb-1">
          <div
            className="flex items-end gap-3 px-1"
            style={{ minWidth: `${pontos.length * 48}px` }}
          >
            {pontos.map((p) => {
              const min = Math.min(...pontos.map((x) => x.peso));
              const max = Math.max(...pontos.map((x) => x.peso));
              const span = max - min || 1;
              const altura = 24 + ((p.peso - min) / span) * 116;
              const distintos = [...new Set(pontos.map((x) => x.peso))].sort((a, b) => b - a);
              const cor =
                p.peso === distintos[0] && distintos.length > 1
                  ? "bg-primary"
                  : p.peso === distintos[1]
                    ? "bg-gold"
                    : p.peso === distintos[distintos.length - 1]
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40";
              return (
                <div key={p.t} className="flex w-10 shrink-0 flex-col items-center">
                  <span className="mb-1 font-display text-xs text-foreground">
                    {p.peso}
                  </span>
                  <div
                    className={`w-3 rounded-sm ${cor} transition-[height] duration-500`}
                    style={{ height: `${altura}px` }}
                  />
                  <span className="mt-1.5 text-[0.6rem] text-muted-foreground">
                    {new Date(p.t).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
