import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/questionario")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Questionário — Leonidas" },
      {
        name: "description",
        content: "Responda algumas perguntas e receba seu treino personalizado.",
      },
      { property: "og:title", content: "Questionário — Leonidas" },
      {
        property: "og:description",
        content: "Responda algumas perguntas e receba seu treino personalizado.",
      },
    ],
  }),
  component: Questionario,
});

type Opt = { label: string; value: string };

const GENEROS: Opt[] = [
  { label: "Masculino", value: "masculino" },
  { label: "Feminino", value: "feminino" },
  { label: "Outro", value: "outro" },
];
const CATEGORIAS: Opt[] = [
  { label: "Iniciante", value: "iniciante" },
  { label: "Intermediário", value: "intermediario" },
  { label: "Intermediário Avançado", value: "intermediario_avancado" },
  { label: "Veterano", value: "veterano" },
  { label: "Veterano Casca Grossa", value: "veterano_casca_grossa" },
];
const OBJETIVOS: Opt[] = [
  { label: "Hipertrofia", value: "hipertrofia" },
  { label: "Emagrecimento", value: "emagrecimento" },
  { label: "Condicionamento", value: "condicionamento" },
  { label: "Força", value: "forca" },
];
const FOCOS: Opt[] = [
  { label: "Glúteo e posterior", value: "gluteo_posterior" },
  { label: "Ombros e braços", value: "ombros_bracos" },
  { label: "Equilibrado", value: "equilibrado" },
  { label: "Foco customizado", value: "foco_customizado" },
];
const GRUPOS = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Quadríceps",
  "Posterior de coxa",
  "Glúteo",
  "Panturrilha",
  "Abdômen",
];

type Form = {
  nome: string;
  idade: string;
  altura_cm: string;
  peso_kg: string;
  genero: string;
  dias_por_semana: string;
  tempo_treino_meses: string;
  categoria: string;
  objetivo: string;
  foco: string;
  foco_grupo_customizado: string;
};

const EMPTY: Form = {
  nome: "",
  idade: "",
  altura_cm: "",
  peso_kg: "",
  genero: "",
  dias_por_semana: "",
  tempo_treino_meses: "",
  categoria: "",
  objetivo: "",
  foco: "",
  foco_grupo_customizado: "",
};

function Questionario() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const steps: {
    titulo: string;
    sub?: string;
    valido: boolean;
    render: () => React.ReactNode;
  }[] = [
    {
      titulo: "Como te chamam?",
      valido: form.nome.trim().length > 1,
      render: () => (
        <TextField value={form.nome} onChange={(v) => set("nome", v)} placeholder="Seu nome" />
      ),
    },
    {
      titulo: "Qual sua idade?",
      valido: +form.idade >= 12 && +form.idade <= 100,
      render: () => (
        <TextField
          type="number"
          value={form.idade}
          onChange={(v) => set("idade", v)}
          placeholder="anos"
        />
      ),
    },
    {
      titulo: "Sua altura",
      sub: "em centímetros",
      valido: +form.altura_cm >= 120 && +form.altura_cm <= 230,
      render: () => (
        <TextField
          type="number"
          value={form.altura_cm}
          onChange={(v) => set("altura_cm", v)}
          placeholder="cm"
        />
      ),
    },
    {
      titulo: "Seu peso",
      sub: "em quilos",
      valido: +form.peso_kg >= 30 && +form.peso_kg <= 300,
      render: () => (
        <TextField
          type="number"
          value={form.peso_kg}
          onChange={(v) => set("peso_kg", v)}
          placeholder="kg"
        />
      ),
    },
    {
      titulo: "Gênero",
      valido: !!form.genero,
      render: () => (
        <Options
          options={GENEROS}
          value={form.genero}
          onChange={(v) => set("genero", v)}
        />
      ),
    },
    {
      titulo: "Quantos dias por semana?",
      valido: !!form.dias_por_semana,
      render: () => (
        <Options
          columns
          options={["1", "2", "3", "4", "5", "6"]}
          value={form.dias_por_semana}
          onChange={(v) => set("dias_por_semana", v)}
        />
      ),
    },
    {
      titulo: "Há quanto tempo treina?",
      sub: "em meses",
      valido: form.tempo_treino_meses !== "" && +form.tempo_treino_meses >= 0,
      render: () => (
        <TextField
          type="number"
          value={form.tempo_treino_meses}
          onChange={(v) => set("tempo_treino_meses", v)}
          placeholder="meses"
        />
      ),
    },
    {
      titulo: "Sua categoria",
      sub: "seja honesto — o treino depende disso",
      valido: !!form.categoria,
      render: () => (
        <Options
          options={CATEGORIAS}
          value={form.categoria}
          onChange={(v) => set("categoria", v)}
        />
      ),
    },
    {
      titulo: "Seu objetivo",
      valido: !!form.objetivo,
      render: () => (
        <Options
          options={OBJETIVOS}
          value={form.objetivo}
          onChange={(v) => set("objetivo", v)}
        />
      ),
    },
    {
      titulo: "Ênfase do treino",
      valido:
        !!form.foco &&
        (form.foco !== "foco_customizado" || !!form.foco_grupo_customizado),
      render: () => (
        <div className="space-y-4">
          <Options options={FOCOS} value={form.foco} onChange={(v) => set("foco", v)} />
          {form.foco === "foco_customizado" && (
            <div className="rise-in">
              <p className="mb-2 text-sm uppercase tracking-widest text-gold">
                Grupo muscular
              </p>
              <Options
                columns
                options={GRUPOS}
                value={form.foco_grupo_customizado}
                onChange={(v) => set("foco_grupo_customizado", v)}
              />
            </div>
          )}
        </div>
      ),
    },
  ];

  const atual = steps[step]!;
  const progresso = ((step + 1) / steps.length) * 100;

  async function finalizar() {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        nome: form.nome.trim(),
        idade: +form.idade,
        altura_cm: +form.altura_cm,
        peso_kg: +form.peso_kg,
        genero: form.genero,
        dias_por_semana: +form.dias_por_semana,
        tempo_treino_meses: +form.tempo_treino_meses,
        objetivo: form.objetivo,
        categoria: form.categoria,
        foco: form.foco,
        foco_grupo_customizado:
          form.foco === "foco_customizado" ? form.foco_grupo_customizado : null,
      };

      const profilePayload: typeof payload & { imc?: number | null } = { ...payload };
      delete profilePayload["imc"];

      const { data: existente } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let profileId = existente?.id as string | undefined;

      if (profileId) {
        const { error } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("id", profileId);
        if (error) throw error;
      } else {
        console.log("[Leonidas] profiles insert payload:", profilePayload);
        const { data, error } = await supabase
          .from("profiles")
          .insert(profilePayload)
          .select("id")
          .single();
        if (error) throw error;
        profileId = data.id as string;
      }

      const { error: rpcError } = await supabase.rpc("generate_workout_plan", {
        p_profile_id: profileId,
      });
      if (rpcError) throw rpcError;

      toast.success("Treino gerado. Bora.");
      navigate({ to: "/treino", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o treino");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <span>
              Etapa {step + 1}/{steps.length}
            </span>
            <span className="flex items-center gap-1 text-gold">
              <Flame className="size-3.5" /> Leonidas
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-secondary">
            <div
              className="h-full rounded-sm transition-[width] duration-500"
              style={{ width: `${progresso}%`, backgroundImage: "var(--gradient-blood)" }}
            />
          </div>
        </div>

        <div key={step} className="rise-in">
          <h1 className="text-4xl leading-tight">{atual.titulo}</h1>
          {atual.sub && (
            <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
              {atual.sub}
            </p>
          )}
          <div className="mt-8">{atual.render()}</div>
        </div>

        <div className="mt-10 flex gap-3">
          {step > 0 && (
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <Button
            className="h-12 flex-1 font-display text-lg tracking-widest"
            disabled={!atual.valido || saving}
            onClick={() => (step === steps.length - 1 ? finalizar() : setStep((s) => s + 1))}
          >
            {saving
              ? "GERANDO TREINO..."
              : step === steps.length - 1
                ? "GERAR MEU TREINO"
                : "CONTINUAR"}
            {!saving && <ArrowRight className="ml-1 size-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Input
      autoFocus
      type={type}
      inputMode={type === "number" ? "numeric" : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-16 rounded-sm border-2 bg-card text-2xl font-semibold"
    />
  );
}

function Options({
  options,
  value,
  onChange,
  columns,
}: {
  options: Array<string | Opt>;
  value: string;
  onChange: (v: string) => void;
  columns?: boolean;
}) {
  const items: Opt[] = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o,
  );
  return (
    <div className={columns ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-3"}>
      {items.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`w-full rounded-sm border-2 px-4 py-4 text-left font-display text-lg uppercase tracking-wide transition-all ${
              active
                ? "border-primary bg-primary/15 text-foreground shadow-[var(--shadow-blood)]"
                : "border-border bg-card text-muted-foreground hover:border-gold/60 hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
