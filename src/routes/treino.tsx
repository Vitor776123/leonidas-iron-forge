import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Crown,
  Menu,
  Plus,
  Repeat,
  Search,
  Timer,
  Trash2,
  X,
  Zap,
} from "lucide-react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SortableList } from "@/components/SortableList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const CUSTOM_KEY = "leonidas:dias-personalizados";

function lerCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function TreinoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<WorkoutExercise | null>(null);
  const [trocando, setTrocando] = useState<WorkoutExercise | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<WorkoutDay | null>(null);
  const [excluindoEx, setExcluindoEx] = useState<WorkoutExercise | null>(null);
  const [adicionarEm, setAdicionarEm] = useState<WorkoutDay | null>(null);
  const [customIds, setCustomIds] = useState<string[]>([]);

  useEffect(() => setCustomIds(lerCustom()), []);

  function marcarCustom(id: string) {
    const novos = Array.from(new Set([...lerCustom(), id]));
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(novos));
    setCustomIds(novos);
  }

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
          "id, ordem, rotulo, workout_exercises(id, workout_day_id, exercise_id, ordem, series, reps_min, reps_max, descanso_segundos, eh_bonus_foco, tecnica_avancada, concluido, observacao, exercises(id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade))",
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
  const ehCustom = !!ativo && customIds.includes(ativo.id);

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

  async function excluirDia(dia: WorkoutDay) {
    try {
      const { error } = await supabase.from("workout_days").delete().eq("id", dia.id);
      if (error) throw error;
      const restantes = dias.filter((d) => d.id !== dia.id);
      if (diaAtivo === dia.id) setDiaAtivo(restantes[0]?.id ?? null);
      const novos = lerCustom().filter((id) => id !== dia.id);
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(novos));
      setCustomIds(novos);
      toast.success(`"${dia.rotulo}" excluído`);
      queryClient.invalidateQueries({ queryKey: ["plano"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir o dia");
    } finally {
      setExcluindo(null);
    }
  }

  async function excluirExercicio(we: WorkoutExercise) {
    try {
      const { error } = await supabase.from("workout_exercises").delete().eq("id", we.id);
      if (error) throw error;
      toast.success(`"${we.exercises?.name_pt ?? "Exercício"}" removido`);
      queryClient.invalidateQueries({ queryKey: ["plano"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover exercício");
    } finally {
      setExcluindoEx(null);
    }
  }

  async function reordenarDias(idsSecao: string[], secao: "gerado" | "custom") {
    const gerados = dias.filter((d) => !customIds.includes(d.id)).map((d) => d.id);
    const personalizados = dias.filter((d) => customIds.includes(d.id)).map((d) => d.id);
    const finais =
      secao === "gerado" ? [...idsSecao, ...personalizados] : [...gerados, ...idsSecao];
    try {
      await Promise.all(
        finais.map((id, i) =>
          supabase.from("workout_days").update({ ordem: i + 1 }).eq("id", id),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["plano"] });
      toast.success("Ordem dos dias atualizada");
    } catch {
      toast.error("Falha ao reordenar os dias");
    }
  }

  async function reordenarExercicios(ids: string[]) {
    try {
      await Promise.all(
        ids.map((id, i) =>
          supabase.from("workout_exercises").update({ ordem: i + 1 }).eq("id", id),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["plano"] });
    } catch {
      toast.error("Falha ao reordenar exercícios");
    }
  }

  async function salvarSeriesReps(
    we: WorkoutExercise,
    v: { series: number; reps_min: number; reps_max: number },
  ) {
    const { error } = await supabase.from("workout_exercises").update(v).eq("id", we.id);
    if (error) {
      toast.error("Falha ao salvar séries/reps");
      return;
    }
    toast.success("Séries e repetições atualizadas");
    queryClient.invalidateQueries({ queryKey: ["plano"] });
  }

  const menuBotao = (
    <button
      onClick={() => setMenuAberto(true)}
      aria-label="Abrir menu de dias"
      className="flex size-11 items-center justify-center rounded-sm text-foreground transition-colors active:bg-secondary"
    >
      <Menu className="size-6" />
    </button>
  );

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
    <AppShell headerLeft={menuBotao}>
      <h1 className="text-4xl">{ativo?.rotulo ?? "Meu treino"}</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {dias.length} dias por semana
      </p>

      <Button
        variant="secondary"
        onClick={() => ativo && setAdicionarEm(ativo)}
        className="mt-5 h-12 w-full font-display tracking-widest"
      >
        <Plus className="mr-1 size-5" /> ADICIONAR EXERCÍCIO
      </Button>

      <div key={ativo?.id} className="rise-in mt-5">
        {ativo?.workout_exercises.length === 0 && (
          <p className="rounded-sm border border-dashed border-border p-6 text-center text-muted-foreground">
            Nenhum exercício neste dia ainda.
          </p>
        )}
        <SortableList
          items={ativo?.workout_exercises ?? []}
          onReorder={reordenarExercicios}
          className="space-y-3"
          renderItem={(we, handle) => (
            <div
              className={`surface-iron relative flex items-stretch rounded-sm border border-border transition-colors hover:border-primary/70 ${
                we.concluido ? "opacity-50" : ""
              }`}
            >
              {handle}
              <div className="min-w-0 flex-1 py-4 pr-12">
                <button
                  onClick={() => setDetalhe(we)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-xl leading-tight">
                      {we.exercises?.name_pt ?? "Exercício"}
                    </h3>
                    {we.concluido && <CheckCircle2 className="size-5 shrink-0 text-gold" />}
                    {we.eh_bonus_foco && <Crown className="size-5 shrink-0 text-gold" />}
                  </div>
                  <p className="mt-0.5 text-sm uppercase tracking-wider text-muted-foreground">
                    {we.exercises?.muscle}
                  </p>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-semibold">
                  <SeriesRepsEditor item={we} onSave={(v) => salvarSeriesReps(we, v)} />
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
              <button
                onClick={() => setExcluindoEx(we)}
                aria-label={`Remover ${we.exercises?.name_pt ?? "exercício"}`}
                className="absolute bottom-0 right-0 top-0 flex w-12 items-center justify-center text-muted-foreground/70 transition-colors active:text-primary"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        />
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
          {!ehCustom && (
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
              Dia do treino gerado
            </p>
          )}
        </div>
      )}

      <DiasDrawer
        open={menuAberto}
        onOpenChange={setMenuAberto}
        dias={dias}
        ativoId={ativo?.id ?? null}
        customIds={customIds}
        onReorder={reordenarDias}
        onSelect={(id) => {
          setDiaAtivo(id);
          setMenuAberto(false);
        }}
        onDelete={(d) => {
          setMenuAberto(false);
          setExcluindo(d);
        }}
        onCriar={() => {
          setMenuAberto(false);
          setCriando(true);
        }}
      />

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl uppercase">
              Excluir "{excluindo?.rotulo}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove todos os exercícios desse dia. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12 font-display tracking-widest">
              CANCELAR
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 bg-primary font-display tracking-widest"
              onClick={() => excluindo && excluirDia(excluindo)}
            >
              EXCLUIR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!excluindoEx} onOpenChange={(o) => !o && setExcluindoEx(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl uppercase">
              Remover exercício?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{excluindoEx?.exercises?.name_pt}" do treino?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12 font-display tracking-widest">
              CANCELAR
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 bg-primary font-display tracking-widest"
              onClick={() => excluindoEx && excluirExercicio(excluindoEx)}
            >
              REMOVER
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CriarDiaDialog
        open={criando}
        planId={data?.planId ?? null}
        proximaOrdem={dias.length ? Math.max(...dias.map((d) => d.ordem)) + 1 : 1}
        onClose={() => setCriando(false)}
        onCreated={(id, rotulo) => {
          setCriando(false);
          marcarCustom(id);
          setDiaAtivo(id);
          queryClient.invalidateQueries({ queryKey: ["plano"] });
          setAdicionarEm({ id, ordem: 0, rotulo, workout_exercises: [] });
        }}
      />

      <ExercisePicker
        dia={adicionarEm}
        onClose={() => {
          setAdicionarEm(null);
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
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["plano"] })}
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

function DiasDrawer({
  open,
  onOpenChange,
  dias,
  ativoId,
  customIds,
  onSelect,
  onDelete,
  onCriar,
  onReorder,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dias: WorkoutDay[];
  ativoId: string | null;
  customIds: string[];
  onSelect: (id: string) => void;
  onDelete: (d: WorkoutDay) => void;
  onCriar: () => void;
  onReorder: (ids: string[], secao: "gerado" | "custom") => void;
}) {
  const gerados = dias.filter((d) => !customIds.includes(d.id));
  const personalizados = dias.filter((d) => customIds.includes(d.id));

  const item = (d: WorkoutDay, handle: ReactNode) => (
    <div
      className={`flex items-stretch overflow-hidden rounded-sm border-2 transition-colors ${
        ativoId === d.id
          ? "border-primary bg-primary/15"
          : "border-border bg-secondary/40"
      }`}
    >
      {handle}
      <button
        onClick={() => onSelect(d.id)}
        className="min-h-[52px] min-w-0 flex-1 py-3 pr-2 text-left font-display text-base uppercase tracking-wide"
      >
        <span className={`block truncate ${ativoId === d.id ? "text-primary" : "text-foreground"}`}>
          {d.rotulo}
        </span>
        <span className="block text-xs tracking-widest text-muted-foreground">
          {d.workout_exercises.length} exercícios
        </span>
      </button>
      <button
        onClick={() => onDelete(d)}
        aria-label={`Excluir ${d.rotulo}`}
        className="flex w-12 shrink-0 items-center justify-center text-muted-foreground transition-colors active:bg-primary/20 active:text-primary"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[78vw] max-w-sm flex-col gap-0 border-border bg-background p-0"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-2xl uppercase tracking-widest">Dias</h2>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Arraste pela alça para reordenar
          </p>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {!!gerados.length && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.25em] text-gold">Treino Gerado</h3>
              <SortableList
                items={gerados}
                onReorder={(ids) => onReorder(ids, "gerado")}
                renderItem={(d, handle) => item(d, handle)}
              />
            </section>
          )}
          {!!personalizados.length && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.25em] text-gold">
                Treinos Personalizados
              </h3>
              <SortableList
                items={personalizados}
                onReorder={(ids) => onReorder(ids, "custom")}
                renderItem={(d, handle) => item(d, handle)}
              />
            </section>
          )}
        </div>

        <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button onClick={onCriar} className="h-12 w-full font-display tracking-widest">
            <Plus className="mr-1 size-5" /> CRIAR TREINO PERSONALIZADO
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetalheDialog({
  item,
  onClose,
  onTrocar,
  onChanged,
}: {
  item: WorkoutExercise | null;
  onClose: () => void;
  onTrocar: (we: WorkoutExercise) => void;
  onChanged: () => void;
}) {
  const ex = item?.exercises;
  const [concluido, setConcluido] = useState(false);
  const [obs, setObs] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);

  useEffect(() => {
    setConcluido(!!item?.concluido);
    setObs(item?.observacao ?? "");
  }, [item?.id, item?.concluido, item?.observacao]);

  async function marcarConcluido(v: boolean) {
    if (!item) return;
    setConcluido(v);
    const { error } = await supabase
      .from("workout_exercises")
      .update({ concluido: v })
      .eq("id", item.id);
    if (error) {
      setConcluido(!v);
      toast.error("Falha ao salvar");
    } else {
      onChanged();
    }
  }

  async function salvarObs() {
    if (!item) return;
    const texto = obs.trim();
    if (texto === (item.observacao ?? "")) return;
    setSalvandoObs(true);
    const { error } = await supabase
      .from("workout_exercises")
      .update({ observacao: texto || null })
      .eq("id", item.id);
    setSalvandoObs(false);
    if (error) {
      toast.error("Falha ao salvar anotação");
    } else {
      toast.success("Anotação salva");
      onChanged();
    }
  }
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overflow-x-hidden border-border bg-card p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-2xl uppercase leading-tight">
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

        <div className="mt-2 space-y-2">
          <label htmlFor="obs-exercicio" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Anotação
          </label>
          <textarea
            id="obs-exercicio"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={salvarObs}
            rows={2}
            placeholder="Anotação (ex: carga usada, ajuste, sensação)"
            className="min-h-[56px] w-full resize-y rounded-sm border border-input bg-secondary/60 px-3 py-2.5 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {salvandoObs && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Salvando...</p>
          )}
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

        <div className="sticky bottom-0 -mx-1 mt-2 space-y-3 bg-card px-1 pb-1 pt-3">
          <button
            onClick={() => marcarConcluido(!concluido)}
            aria-pressed={concluido}
            className={`flex min-h-[56px] w-full items-center justify-center gap-3 rounded-sm border-2 font-display text-lg uppercase tracking-widest transition-colors ${
              concluido
                ? "border-gold bg-gold/15 text-gold"
                : "border-border bg-secondary/60 text-foreground active:bg-secondary"
            }`}
          >
            <CheckCircle2 className="size-6" />
            {concluido ? "Concluído" : "Marcar como concluído"}
          </button>
          <Button
            variant="secondary"
            className="h-12 w-full font-display tracking-widest"
            onClick={() => item && onTrocar(item)}
          >
            <Repeat className="mr-1 size-5" /> TROCAR EXERCÍCIO
          </Button>
        </div>
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

const MUSCULOS: { value: string; label: string }[] = [
  { value: "abductors", label: "Abdutores" },
  { value: "abs", label: "Abdômen" },
  { value: "adductors", label: "Adutores" },
  { value: "biceps", label: "Bíceps" },
  { value: "calves", label: "Panturrilhas" },
  { value: "delts", label: "Deltoides" },
  { value: "forearms", label: "Antebraços" },
  { value: "glutes", label: "Glúteos" },
  { value: "hamstrings", label: "Posterior" },
  { value: "lats", label: "Dorsais" },
  { value: "pectorals", label: "Peitorais" },
  { value: "quads", label: "Quadríceps" },
  { value: "traps", label: "Trapézio" },
  { value: "triceps", label: "Tríceps" },
  { value: "upper back", label: "Costas sup." },
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
  onCreated: (dayId: string, rotulo: string) => void;
}) {
  const [rotulo, setRotulo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setRotulo("");
      setBusy(false);
    }
  }, [open]);

  async function criarDia() {
    if (!planId || rotulo.trim().length < 2) return;
    setBusy(true);
    try {
      const nome = rotulo.trim();
      const { data, error } = await supabase
        .from("workout_days")
        .insert({ workout_plan_id: planId, rotulo: nome, ordem: proximaOrdem })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Dia criado. Agora adicione exercícios.");
      onCreated(data.id as string, nome);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar o dia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-2xl uppercase">
            Novo dia personalizado
          </DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

function ExercisePicker({
  dia,
  onClose,
}: {
  dia: WorkoutDay | null;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipos, setEquipos] = useState<string[]>([]);
  const [adicionados, setAdicionados] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dia) {
      setBusca("");
      setMusculo(null);
      setEquipos([]);
      setAdicionados(0);
    }
  }, [dia?.id]);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["ex-busca", busca, musculo, equipos.join(",")],
    enabled: !!dia,
    queryFn: async () => {
      let q = supabase
        .from("exercises")
        .select("id, name_pt, muscle, body_part, equipment, gif_url, instructions_pt, dificuldade")
        .order("name_pt")
        .limit(60);
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

  async function adicionar(ex: Exercise) {
    if (!dia) return;
    setBusy(true);
    try {
      const { count } = await supabase
        .from("workout_exercises")
        .select("id", { count: "exact", head: true })
        .eq("workout_day_id", dia.id);
      const { error } = await supabase.from("workout_exercises").insert({
        workout_day_id: dia.id,
        exercise_id: ex.id,
        ordem: (count ?? 0) + 1,
        ...PADRAO,
        eh_bonus_foco: false,
      });
      if (error) throw error;
      setAdicionados((n) => n + 1);
      toast.success(`${ex.name_pt} adicionado!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar exercício");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!dia} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background left-0 top-0 p-0 sm:h-[92vh] sm:max-h-[92vh] sm:w-[92vw] sm:max-w-2xl sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-sm sm:border [&>button]:hidden">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <DialogHeader className="min-w-0 flex-1 space-y-0 text-left">
            <DialogTitle className="font-display text-2xl uppercase leading-tight">
              Adicionar Exercício
            </DialogTitle>
            <p className="truncate text-sm uppercase tracking-widest text-gold">
              {dia?.rotulo}
            </p>
          </DialogHeader>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-border text-foreground transition-colors active:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              placeholder="Buscar exercício pelo nome..."
              onChange={(e) => setBusca(e.target.value)}
              className="h-14 rounded-sm border-2 bg-secondary pl-12 text-base"
            />
          </div>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.25em] text-gold">Grupo muscular</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <ChipMusculo ativo={!musculo} label="Todos" onClick={() => setMusculo(null)} />
              {MUSCULOS.map((m) => (
                <ChipMusculo
                  key={m.value}
                  ativo={musculo === m.value}
                  label={m.label}
                  onClick={() => setMusculo(musculo === m.value ? null : m.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.25em] text-gold">Equipamento</h3>
            <div className="grid grid-cols-2 gap-3">
              {EQUIPAMENTOS.map((eq) => {
                const on = equipos.includes(eq.key);
                return (
                  <label
                    key={eq.key}
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-sm border-2 px-4 text-sm uppercase tracking-wide transition-colors ${
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
                      className="size-5 accent-[hsl(var(--primary))]"
                    />
                    {eq.label}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            {isLoading && <p className="text-muted-foreground">Carregando exercícios...</p>}
            {lista?.length === 0 && (
              <p className="text-muted-foreground">Nenhum exercício encontrado.</p>
            )}
            <div className="space-y-3">
              {lista?.map((ex) => (
                <button
                  key={ex.id}
                  disabled={busy}
                  onClick={() => adicionar(ex)}
                  className="surface-iron flex w-full items-center gap-4 rounded-sm border border-border p-3 text-left transition-colors active:border-primary hover:border-gold disabled:opacity-50"
                >
                  {ex.gif_url ? (
                    <img
                      src={ex.gif_url}
                      alt={ex.name_pt}
                      loading="lazy"
                      className="size-20 shrink-0 rounded-sm border border-border bg-secondary object-cover"
                    />
                  ) : (
                    <span className="size-20 shrink-0 rounded-sm bg-secondary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg uppercase leading-tight">
                      {ex.name_pt}
                    </span>
                    <span className="mt-1 block text-sm uppercase tracking-wider text-muted-foreground">
                      {ex.muscle}
                    </span>
                  </span>
                  <Plus className="size-6 shrink-0 text-gold" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button onClick={onClose} className="h-14 w-full font-display text-lg tracking-widest">
            CONCLUIR{adicionados ? ` (${adicionados})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChipMusculo({
  ativo,
  label,
  onClick,
}: {
  ativo: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[48px] rounded-sm border-2 px-3 text-sm uppercase tracking-wide transition-colors ${
        ativo
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-secondary/50 text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
