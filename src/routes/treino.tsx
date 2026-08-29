import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Crown, Plus, Repeat, Search, Timer, Zap } from "lucide-react";
import {
  supabase,
  type Exercise,
  type WorkoutDay,
  type WorkoutExercise,
} from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/treino")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu Treino — Leonidas" },
      {
        name: "description",
        content: "Seu plano de treino por dia: séries, repetições, descanso e execução.",
      },
      { property: "og:title", content: "Meu Treino — Leonidas" },
      {
        property: "og:description",
        content: "Seu plano de treino por dia: séries, repetições, descanso e execução.",
      },
    ],
  }),
  component: TreinoPage,
});

function TreinoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<WorkoutExercise | null>(null);
  const [trocando, setTrocando] = useState<WorkoutExercise | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["plano", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const vazio = { semPerfil: false, planId: null as string | null, atualId: null as string | null, dias: [] as WorkoutDay[] };
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!profile) return { ...vazio, semPerfil: true };

      const { data: plan } = await supabase
        .from("workout_plans")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("ativo", true)
        .maybeSingle();
      if (!plan) return vazio;

      const { data: dias, error } = await supabase
        .from("workout_days")
        .select(
          "id, ordem, rotulo, workout_exercises(id, workout_day_id, exercise_id, ordem, series, reps_min, reps_max, descanso_segundos, eh_bonus_foco, tecnica_avancada, exercises(id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade))",
        )
        .eq("workout_plan_id", plan.id)
        .order("ordem");
      if (error) throw error;

      const { data: atualId } = await supabase.rpc("get_current_workout_day", {
        p_plan_id: plan.id,
      });

      const normalizados = ((dias ?? []) as unknown as WorkoutDay[]).map((d) => ({
        ...d,
        workout_exercises: [...(d.workout_exercises ?? [])].sort(
          (a, b) => a.ordem - b.ordem,
        ),
      }));
      return {
        semPerfil: false,
        planId: plan.id as string,
        atualId: (atualId as string | null) ?? null,
        dias: normalizados,
      };
    },
  });

  useEffect(() => {
    if (data?.semPerfil) navigate({ to: "/questionario", replace: true });
  }, [data, navigate]);

  useEffect(() => {
    if (!diaAtivo && data?.atualId) setDiaAtivo(data.atualId);
  }, [data?.atualId, diaAtivo]);

  const dias = data?.dias ?? [];
  const ativo = dias.find((d) => d.id === diaAtivo) ?? dias[0];

  async function finalizarDia() {
    if (!ativo) return;
    setFinalizando(true);
    try {
      const { data: proximo, error } = await supabase.rpc("complete_workout_day", {
        p_day_id: ativo.id,
      });
      if (error) throw error;
      toast.success("Treino finalizado. Boa!");
      if (proximo) setDiaAtivo(proximo as string);
      queryClient.invalidateQueries({ queryKey: ["plano"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao finalizar treino");
    } finally {
      setFinalizando(false);
    }
  }


  if (isLoading) {
    return (
      <AppShell>
        <p className="font-display text-2xl tracking-widest text-muted-foreground">
          Carregando treino...
        </p>
      </AppShell>
    );
  }

  if (!dias.length) {
    return (
      <AppShell>
        <h1 className="text-4xl">Nenhum plano ativo</h1>
        <p className="mt-3 text-muted-foreground">Refaça o questionário para gerar um.</p>
        <Button
          className="mt-6 h-12 font-display tracking-widest"
          onClick={() => navigate({ to: "/questionario" })}
        >
          RESPONDER QUESTIONÁRIO
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-4xl">Meu treino</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {dias.length} dias por semana
      </p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2">
        {dias.map((d) => {
          const on = ativo?.id === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDiaAtivo(d.id)}
              className={`shrink-0 rounded-sm border-2 px-4 py-3 font-display text-base uppercase tracking-wide transition-all ${
                on
                  ? "border-primary bg-primary/15 text-foreground shadow-[var(--shadow-blood)]"
                  : "border-border bg-card text-muted-foreground hover:border-gold/60"
              }`}
            >
              {d.rotulo}
            </button>
          );
        })}
        <button
          onClick={() => setCriando(true)}
          className="shrink-0 rounded-sm border-2 border-dashed border-gold/60 px-4 py-3 font-display text-base uppercase tracking-wide text-gold"
        >
          <Plus className="mr-1 inline size-4" /> Novo dia
        </button>
      </div>


      <div key={ativo?.id} className="rise-in mt-6 space-y-3">
        {ativo?.workout_exercises.map((we, i) => (
          <button
            key={we.id}
            onClick={() => setDetalhe(we)}
            className="surface-iron flex w-full items-center gap-4 rounded-sm border border-border p-4 text-left transition-colors hover:border-primary/70"
          >
            <span className="font-display text-2xl text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-xl leading-tight">
                  {we.exercises?.name_pt ?? "Exercício"}
                </h3>
                {we.eh_bonus_foco && <Crown className="size-5 shrink-0 text-gold" />}
              </div>
              <p className="mt-0.5 text-sm uppercase tracking-wider text-muted-foreground">
                {we.exercises?.muscle}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-semibold">
                <span>
                  {we.series} × {we.reps_min}-{we.reps_max}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="size-4" />
                  {we.descanso_segundos}s
                </span>
                {we.tecnica_avancada && (
                  <span className="flex items-center gap-1 text-primary">
                    <Zap className="size-4" />
                    {we.tecnica_avancada}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!!ativo && (
        <div className="mt-8 space-y-3">
          <Button
            disabled={finalizando}
            onClick={finalizarDia}
            className="h-14 w-full font-display text-lg tracking-widest"
          >
            <CheckCircle2 className="mr-1 size-6" />
            {finalizando ? "SALVANDO..." : "TREINO FINALIZADO"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setCriando(true)}
            className="h-12 w-full font-display tracking-widest"
          >
            <Plus className="mr-1 size-5" /> CRIAR TREINO PERSONALIZADO
          </Button>
        </div>
      )}

      <CriarDiaDialog
        open={criando}
        planId={data?.planId ?? null}
        proximaOrdem={dias.length ? Math.max(...dias.map((d) => d.ordem)) + 1 : 1}
        onClose={() => setCriando(false)}
        onCreated={(id) => {
          setCriando(false);
          setDiaAtivo(id);
          queryClient.invalidateQueries({ queryKey: ["plano"] });
        }}
      />

      <DetalheDialog
        item={detalhe}
        onClose={() => setDetalhe(null)}
        onTrocar={(we) => {
          setDetalhe(null);
          setTrocando(we);
        }}
      />

      <TrocaDialog
        item={trocando}
        onClose={() => setTrocando(null)}
        onDone={() => {
          setTrocando(null);
          queryClient.invalidateQueries({ queryKey: ["plano"] });
        }}
      />
    </AppShell>
  );
}

function DetalheDialog({
  item,
  onClose,
  onTrocar,
}: {
  item: WorkoutExercise | null;
  onClose: () => void;
  onTrocar: (we: WorkoutExercise) => void;
}) {
  const ex = item?.exercises;
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-2xl uppercase">
            {ex?.name_pt}
          </DialogTitle>
        </DialogHeader>
        {ex?.gif_url && (
          <img
            src={ex.gif_url}
            alt={`Execução do exercício ${ex.name_pt}`}
            loading="lazy"
            className="w-full rounded-sm border border-border bg-secondary"
          />
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-base font-semibold">
          <span>
            {item?.series} × {item?.reps_min}-{item?.reps_max}
          </span>
          <span className="text-muted-foreground">{item?.descanso_segundos}s descanso</span>
          {item?.tecnica_avancada && (
            <span className="text-primary">{item.tecnica_avancada}</span>
          )}
          {item?.eh_bonus_foco && <span className="text-gold">Bônus de foco</span>}
        </div>
        {!!ex?.instructions_pt?.length && (
          <ol className="mt-2 space-y-2">
            {ex.instructions_pt.map((p, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed">
                <span className="font-display text-primary">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        )}
        <Button
          variant="secondary"
          className="mt-2 h-12 font-display tracking-widest"
          onClick={() => item && onTrocar(item)}
        >
          <Repeat className="mr-1 size-5" /> TROCAR EXERCÍCIO
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TrocaDialog({
  item,
  onClose,
  onDone,
}: {
  item: WorkoutExercise | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const muscle = item?.exercises?.muscle;

  const { data: alternativas, isLoading } = useQuery({
    queryKey: ["alternativas", muscle, item?.exercise_id],
    enabled: !!item && !!muscle,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade")
        .eq("muscle", muscle!)
        .neq("id", item!.exercise_id)
        .limit(40);
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  async function trocar(novo: Exercise) {
    if (!item) return;
    setBusy(true);
    try {
      const { error: swapError } = await supabase.from("exercise_swaps").insert({
        workout_exercise_id: item.id,
        exercise_original_id: item.exercise_id,
        exercise_novo_id: novo.id,
      });
      if (swapError) throw swapError;

      const { error } = await supabase
        .from("workout_exercises")
        .update({ exercise_id: novo.id })
        .eq("id", item.id);
      if (error) throw error;

      toast.success(`Trocado por ${novo.name_pt}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao trocar exercício");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-2xl uppercase">
            Trocar — {muscle}
          </DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground">Buscando alternativas...</p>}
        <div className="space-y-2">
          {alternativas?.map((a) => (
            <button
              key={a.id}
              disabled={busy}
              onClick={() => trocar(a)}
              className="flex w-full items-center gap-3 rounded-sm border border-border bg-secondary/60 p-3 text-left transition-colors hover:border-gold disabled:opacity-50"
            >
              {a.gif_url && (
                <img
                  src={a.gif_url}
                  alt={a.name_pt}
                  loading="lazy"
                  className="size-14 shrink-0 rounded-sm object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="block truncate font-display text-lg uppercase">
                  {a.name_pt}
                </span>
                <span className="block text-sm text-muted-foreground">{a.equipment}</span>
              </span>
            </button>
          ))}
          {alternativas?.length === 0 && (
            <p className="text-muted-foreground">Nenhuma alternativa encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


const PADRAO = { series: 3, reps_min: 8, reps_max: 12, descanso_segundos: 75 };

const EQUIPAMENTOS: { key: string; label: string; values: string[] }[] = [
  { key: "maquinas", label: "Máquinas", values: ["machine", "lever"] },
  { key: "corpo", label: "Peso do corpo", values: ["bodyweight"] },
  { key: "halteres", label: "Halteres", values: ["dumbbell"] },
  { key: "elastico", label: "Elástico", values: ["band"] },
];

const MUSCULOS = [
  "abductors","abs","adductors","biceps","calves","delts","forearms","glutes",
  "hamstrings","lats","pectorals","quads","traps","triceps","upper back",
];

function CriarDiaDialog({
  open,
  planId,
  proximaOrdem,
  onClose,
  onCreated,
}: {
  open: boolean;
  planId: string | null;
  proximaOrdem: number;
  onClose: () => void;
  onCreated: (dayId: string) => void;
}) {
  const [rotulo, setRotulo] = useState("");
  const [dayId, setDayId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipos, setEquipos] = useState<string[]>([]);
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setRotulo("");
      setDayId(null);
      setBusca("");
      setMusculo(null);
      setEquipos([]);
      setAdicionados([]);
    }
  }, [open]);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["ex-busca", busca, musculo, equipos.join(",")],
    enabled: open && !!dayId,
    queryFn: async () => {
      let q = supabase
        .from("exercises")
        .select("id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade")
        .order("name_pt")
        .limit(50);
      if (busca.trim()) q = q.ilike("name_pt", `%${busca.trim()}%`);
      if (musculo) q = q.eq("muscle", musculo);
      if (equipos.length) {
        const vals = equipos.flatMap((k) => EQUIPAMENTOS.find((e) => e.key === k)?.values ?? []);
        if (vals.length) q = q.in("equipment", vals);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  async function criarDia() {
    if (!planId || rotulo.trim().length < 2) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("workout_days")
        .insert({ workout_plan_id: planId, rotulo: rotulo.trim(), ordem: proximaOrdem })
        .select("id")
        .single();
      if (error) throw error;
      setDayId(data.id as string);
      toast.success("Dia criado. Agora adicione exercícios.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar o dia");
    } finally {
      setBusy(false);
    }
  }

  async function adicionar(ex: Exercise) {
    if (!dayId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("workout_exercises").insert({
        workout_day_id: dayId,
        exercise_id: ex.id,
        ordem: adicionados.length + 1,
        ...PADRAO,
        eh_bonus_foco: false,
      });
      if (error) throw error;
      setAdicionados((a) => [...a, ex.name_pt]);
      toast.success(`${ex.name_pt} adicionado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar exercício");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-2xl uppercase">
            {dayId ? `Exercícios — ${rotulo}` : "Novo dia personalizado"}
          </DialogTitle>
        </DialogHeader>

        {!dayId ? (
          <div className="space-y-4">
            <Input
              autoFocus
              value={rotulo}
              placeholder="Ex: Peito, Ombro e Tríceps"
              onChange={(e) => setRotulo(e.target.value)}
              className="h-14 rounded-sm border-2 bg-secondary text-lg"
            />
            <Button
              disabled={busy || rotulo.trim().length < 2 || !planId}
              onClick={criarDia}
              className="h-12 w-full font-display tracking-widest"
            >
              CRIAR DIA
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {EQUIPAMENTOS.map((eq) => {
                const on = equipos.includes(eq.key);
                return (
                  <label
                    key={eq.key}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm border-2 px-3 py-2 text-sm uppercase tracking-wide transition-colors ${
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setEquipos((cur) =>
                          cur.includes(eq.key)
                            ? cur.filter((k) => k !== eq.key)
                            : [...cur, eq.key],
                        )
                      }
                      className="size-4 accent-[hsl(var(--primary))]"
                    />
                    {eq.label}
                  </label>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                placeholder="Buscar exercício..."
                onChange={(e) => setBusca(e.target.value)}
                className="h-12 rounded-sm border-2 bg-secondary pl-10"
              />
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                onClick={() => setMusculo(null)}
                className={`shrink-0 rounded-sm border px-3 py-2 text-sm uppercase ${!musculo ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                Todos
              </button>
              {MUSCULOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMusculo(m)}
                  className={`shrink-0 rounded-sm border px-3 py-2 text-sm uppercase ${musculo === m ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {isLoading && <p className="text-muted-foreground">Carregando...</p>}
            <div className="space-y-2">
              {lista?.map((ex) => (
                <button
                  key={ex.id}
                  disabled={busy}
                  onClick={() => adicionar(ex)}
                  className="flex w-full items-center gap-3 rounded-sm border border-border bg-secondary/60 p-3 text-left transition-colors hover:border-gold disabled:opacity-50"
                >
                  {ex.gif_url && (
                    <img
                      src={ex.gif_url}
                      alt={ex.name_pt}
                      loading="lazy"
                      className="size-12 shrink-0 rounded-sm object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base uppercase">
                      {ex.name_pt}
                    </span>
                    <span className="block text-xs text-muted-foreground">{ex.muscle}</span>
                  </span>
                  <Plus className="size-5 shrink-0 text-gold" />
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              className="h-12 w-full font-display tracking-widest"
              disabled={!adicionados.length}
              onClick={() => onCreated(dayId)}
            >
              CONCLUIR ({adicionados.length})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
