import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type WorkoutDay } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/aluno/$alunoId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aluno — Leonidas" },
      { name: "description", content: "Acompanhe e edite o treino do seu aluno." },
      { property: "og:title", content: "Aluno — Leonidas" },
      {
        property: "og:description",
        content: "Acompanhe e edite o treino do seu aluno.",
      },
    ],
  }),
  component: AlunoPage,
});

function AlunoPage() {
  const { alunoId } = useParams({ from: "/aluno/$alunoId" });
  const { user, loading } = useAuth();
  const { ehGestor, loading: loadingPerfil } = usePerfil();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loadingPerfil && user && !ehGestor) navigate({ to: "/treino", replace: true });
  }, [loadingPerfil, ehGestor, user, navigate]);

  const { data: aluno } = useQuery({
    queryKey: ["aluno", alunoId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, idade, altura_cm, peso_kg, categoria, objetivo, dias_por_semana")
        .eq("id", alunoId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        nome: string | null;
        idade: number | null;
        altura_cm: number | null;
        peso_kg: number | null;
        categoria: string | null;
        objetivo: string | null;
        dias_por_semana: number | null;
      } | null;
    },
  });

  const { data: plano, isLoading: carregandoPlano } = useQuery({
    queryKey: ["aluno-plano", alunoId],
    enabled: !!aluno?.id,
    queryFn: async () => {
      const { data: plan } = await supabase
        .from("workout_plans")
        .select("id")
        .eq("profile_id", alunoId)
        .eq("ativo", true)
        .maybeSingle();
      if (!plan) return { planId: null as string | null, dias: [] as WorkoutDay[] };

      const { data: dias, error } = await supabase
        .from("workout_days")
        .select(
          "id, ordem, rotulo, workout_exercises(id, workout_day_id, exercise_id, ordem, series, reps_min, reps_max, descanso_segundos, eh_bonus_foco, tecnica_avancada, concluido, observacao, tipo, minutos_realizados, calorias_realizadas, exercises(id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade))",
        )
        .eq("workout_plan_id", plan.id)
        .order("ordem");
      if (error) throw error;

      const normalizados = ((dias ?? []) as unknown as WorkoutDay[]).map((d) => ({
        ...d,
        workout_exercises: [...(d.workout_exercises ?? [])].sort((a, b) => a.ordem - b.ordem),
      }));
      return { planId: plan.id as string, dias: normalizados };
    },
  });

  const { data: pesos } = useQuery({
    queryKey: ["aluno-pesos", alunoId],
    enabled: !!aluno?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peso_registros")
        .select("id, peso_kg, created_at")
        .eq("profile_id", alunoId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as { id: string; peso_kg: number; created_at: string }[];
    },
  });

  async function regenerar() {
    const { error } = await supabase.rpc("generate_workout_plan", { p_profile_id: alunoId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Novo plano gerado.");
    qc.invalidateQueries({ queryKey: ["aluno-plano", alunoId] });
  }

  async function excluirExercicio(id: string) {
    if (!confirm("Excluir este exercício?")) return;
    const { error } = await supabase.from("workout_exercises").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["aluno-plano", alunoId] });
  }

  async function salvarSeries(
    id: string,
    v: { series: number; reps_min: number; reps_max: number },
  ) {
    const { error } = await supabase.from("workout_exercises").update(v).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Atualizado.");
    qc.invalidateQueries({ queryKey: ["aluno-plano", alunoId] });

  }

  return (
    <AppShell
      headerLeft={
        <button
          aria-label="Voltar"
          onClick={() => navigate({ to: "/organizacao" })}
          className="flex size-11 items-center justify-center rounded-sm text-muted-foreground active:bg-secondary"
        >
          <ArrowLeft className="size-5" />
        </button>
      }
    >
      <h1 className="text-4xl">{aluno?.nome ?? "Aluno"}</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {aluno?.categoria ?? "—"} · {aluno?.dias_por_semana ?? "—"}x / semana
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Info label="Idade" value={aluno?.idade ? `${aluno.idade}` : "—"} />
        <Info label="Altura" value={aluno?.altura_cm ? `${aluno.altura_cm} cm` : "—"} />
        <Info label="Peso" value={aluno?.peso_kg ? `${aluno.peso_kg} kg` : "—"} />
      </div>

      <div className="surface-iron mt-6 rounded-sm border border-border p-5">
        <h2 className="text-xl">Últimas pesagens</h2>
        {(pesos?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {pesos!.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className="font-display text-gold">{p.peso_kg} kg</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-2xl">Plano de treino</h2>
        <Button variant="secondary" className="h-11" onClick={regenerar}>
          <RefreshCw className="mr-1 size-4" /> GERAR
        </Button>
      </div>

      {carregandoPlano && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}
      {!carregandoPlano && (plano?.dias.length ?? 0) === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Este aluno ainda não possui plano ativo.
        </p>
      )}

      <div className="mt-4 space-y-5">
        {plano?.dias.map((dia) => (
          <div key={dia.id} className="surface-iron rounded-sm border border-border p-4">
            <h3 className="font-display text-lg uppercase tracking-widest text-gold">
              {dia.rotulo}
            </h3>
            <div className="mt-3 space-y-2">
              {dia.workout_exercises.map((we) => (
                <LinhaExercicio
                  key={we.id}
                  nome={we.exercises?.name_pt ?? "Exercício"}
                  series={we.series}
                  repsMin={we.reps_min}
                  repsMax={we.reps_max}
                  cardio={we.tipo === "cardio"}
                  onSalvar={(v) => salvarSeries(we.id, v)}
                  onExcluir={() => excluirExercicio(we.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-iron rounded-sm border border-border p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}

function LinhaExercicio({
  nome,
  series,
  repsMin,
  repsMax,
  cardio,
  onSalvar,
  onExcluir,
}: {
  nome: string;
  series: number;
  repsMin: number;
  repsMax: number;
  cardio: boolean;
  onSalvar: (v: { series: number; reps_min: number; reps_max: number }) => void;
  onExcluir: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [s, setS] = useState(String(series));
  const [mn, setMn] = useState(String(repsMin));
  const [mx, setMx] = useState(String(repsMax));

  return (
    <div className="rounded-sm border border-border/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm">{nome}</p>
        {!cardio && (
          <button
            onClick={() => setEditando((v) => !v)}
            className="rounded-sm border border-border px-2 py-2 font-display text-xs tracking-widest text-gold"
          >
            {series}×{repsMin}-{repsMax}
          </button>
        )}
        <button
          onClick={onExcluir}
          aria-label="Excluir exercício"
          className="flex size-10 items-center justify-center rounded-sm text-muted-foreground active:bg-secondary"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {editando && (
        <div className="mt-3 flex items-end gap-2">
          <Campo label="Séries" value={s} onChange={setS} />
          <Campo label="Rep. mín" value={mn} onChange={setMn} />
          <Campo label="Rep. máx" value={mx} onChange={setMx} />
          <Button
            className="h-11"
            onClick={() => {
              onSalvar({ series: +s, reps_min: +mn, reps_max: +mx });
              setEditando(false);
            }}
          >
            OK
          </Button>
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <Input
        className="h-11"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
