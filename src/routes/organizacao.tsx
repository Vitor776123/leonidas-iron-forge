import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, Copy, Mail, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/organizacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Organização — Leonidas" },
      {
        name: "description",
        content: "Gestão de academias, professores e alunos no Leonidas.",
      },
      { property: "og:title", content: "Organização — Leonidas" },
      {
        property: "og:description",
        content: "Gestão de academias, professores e alunos no Leonidas.",
      },
    ],
  }),
  component: OrganizacaoPage,
});

type Pessoa = {
  id: string;
  nome: string | null;
  role: string | null;
  categoria: string | null;
  objetivo: string | null;
};

type Organizacao = {
  id: string;
  nome_exibicao: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  limite_professores: number | null;
  limite_alunos: number | null;
  diretor_id: string | null;
};

function mensagemAmigavel(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("limite") && m.includes("professor"))
    return "Limite de professores atingido para esta academia.";
  if (m.includes("limite") && m.includes("aluno"))
    return "Limite de alunos atingido para esta academia.";
  return msg;
}

function OrganizacaoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { perfil, role, ehGestor, loading: loadingPerfil } = usePerfil();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loadingPerfil && perfil && !ehGestor) navigate({ to: "/treino", replace: true });
  }, [loadingPerfil, perfil, ehGestor, navigate]);

  if (role === "dono") return <TelaDono perfilId={perfil?.id} />;
  return <TelaGestor perfilId={perfil?.id} ehDiretor={role === "diretor"} />;
}

/* ------------------------------- DONO ------------------------------- */

function TelaDono({ perfilId }: { perfilId: string | undefined }) {
  const { data: orgs, isLoading, refetch } = useQuery({
    queryKey: ["orgs-dono", perfilId],
    enabled: !!perfilId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizacoes")
        .select(
          "id, nome_exibicao, logo_url, cor_primaria, cor_secundaria, limite_professores, limite_alunos, diretor_id",
        )
        .eq("criado_por_dono_id", perfilId!)
        .order("nome_exibicao");
      if (error) throw error;
      return (data ?? []) as Organizacao[];
    },
  });

  const diretorIds = (orgs ?? []).map((o) => o.diretor_id).filter(Boolean) as string[];
  const { data: diretores } = useQuery({
    queryKey: ["diretores", diretorIds.join(",")],
    enabled: diretorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", diretorIds);
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string | null }[];
    },
  });

  return (
    <AppShell>
      <h1 className="text-4xl">Plataforma</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        Suas academias
      </p>

      <CriarDiretor onCriado={() => refetch()} />

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (orgs?.length ?? 0) === 0 && (
          <div className="surface-iron rounded-sm border border-border p-6 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma academia criada ainda.
            </p>
          </div>
        )}
        {orgs?.map((org) => (
          <CardOrganizacao
            key={org.id}
            org={org}
            diretorNome={diretores?.find((d) => d.id === org.diretor_id)?.nome ?? null}
            onSalvo={() => refetch()}
          />
        ))}
      </div>
    </AppShell>
  );
}

function CardOrganizacao({
  org,
  diretorNome,
  onSalvo,
}: {
  org: Organizacao;
  diretorNome: string | null;
  onSalvo: () => void;
}) {
  const [logo, setLogo] = useState(org.logo_url ?? "");
  const [cor1, setCor1] = useState(org.cor_primaria ?? "#E11D2A");
  const [cor2, setCor2] = useState(org.cor_secundaria ?? "#000000");
  const [limProf, setLimProf] = useState(String(org.limite_professores ?? ""));
  const [limAlu, setLimAlu] = useState(String(org.limite_alunos ?? ""));
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("organizacoes")
        .update({
          logo_url: logo.trim() || null,
          cor_primaria: cor1 || null,
          cor_secundaria: cor2 || null,
          limite_professores: limProf === "" ? null : Number(limProf),
          limite_alunos: limAlu === "" ? null : Number(limAlu),
        })
        .eq("id", org.id);
      if (error) throw error;
      toast.success("Academia atualizada.");
      onSalvo();
    } catch (err) {
      toast.error(
        mensagemAmigavel(err instanceof Error ? err.message : "Falha ao salvar"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-iron space-y-4 rounded-sm border border-border p-4">
      <div>
        <p className="font-display text-xl uppercase tracking-wide">
          {org.nome_exibicao ?? "Academia"}
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Diretor: {diretorNome ?? "—"}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Logo (URL)</Label>
        <Input
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://…"
          className="h-12 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cor primária</Label>
          <input
            type="color"
            value={cor1}
            onChange={(e) => setCor1(e.target.value)}
            className="h-12 w-full rounded-sm border border-border bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label>Cor secundária</Label>
          <input
            type="color"
            value={cor2}
            onChange={(e) => setCor2(e.target.value)}
            className="h-12 w-full rounded-sm border border-border bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Limite professores</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={limProf}
            onChange={(e) => setLimProf(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Limite alunos</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={limAlu}
            onChange={(e) => setLimAlu(e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      <Button onClick={salvar} disabled={busy} className="h-12 w-full font-display tracking-widest">
        {busy ? "..." : "SALVAR"}
      </Button>
    </div>
  );
}

function CriarDiretor({ onCriado }: { onCriado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [academia, setAcademia] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [cor1, setCor1] = useState("#E11D2A");
  const [cor2, setCor2] = useState("#000000");
  const [busy, setBusy] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function criar() {
    if (!academia.trim() || !nome.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-diretor", {
        body: {
          nome_academia: academia.trim(),
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          logo_url: logo.trim() || null,
          cor_primaria: cor1,
          cor_secundaria: cor2,
        },
      });
      if (error) throw error;
      const resp = data as { senha_temporaria?: string; error?: string } | null;
      if (resp?.error) throw new Error(resp.error);
      if (!resp?.senha_temporaria) throw new Error("Resposta inválida da função");
      setSenhaGerada(resp.senha_temporaria);
      setAcademia("");
      setNome("");
      setEmail("");
      setLogo("");
      onCriado();
      toast.success("Academia e diretor criados.");
    } catch (err) {
      toast.error(
        mensagemAmigavel(err instanceof Error ? err.message : "Falha ao criar academia"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setSenhaGerada(null);
          setAberto(true);
        }}
        className="mt-5 h-12 w-full font-display text-base tracking-widest"
      >
        <UserPlus className="mr-2 size-5" /> CRIAR DIRETOR / ACADEMIA
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Nova academia
            </DialogTitle>
          </DialogHeader>

          {senhaGerada ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Senha temporária do diretor (anote agora, não será exibida de novo):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-sm border border-border bg-secondary px-3 py-3 text-lg tracking-widest">
                  {senhaGerada}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(senhaGerada);
                    toast.success("Copiada.");
                  }}
                  className="flex size-12 items-center justify-center rounded-sm border border-border"
                  aria-label="Copiar senha"
                >
                  <Copy className="size-5" />
                </button>
              </div>
              <Button className="h-12 w-full" onClick={() => setAberto(false)}>
                FECHAR
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da academia</Label>
                <Input
                  value={academia}
                  onChange={(e) => setAcademia(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do diretor</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail do diretor</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo (URL, opcional)</Label>
                <Input
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://…"
                  className="h-12 text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cor primária</Label>
                  <input
                    type="color"
                    value={cor1}
                    onChange={(e) => setCor1(e.target.value)}
                    className="h-12 w-full rounded-sm border border-border bg-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor secundária</Label>
                  <input
                    type="color"
                    value={cor2}
                    onChange={(e) => setCor2(e.target.value)}
                    className="h-12 w-full rounded-sm border border-border bg-transparent"
                  />
                </div>
              </div>
              <Button
                onClick={criar}
                disabled={busy}
                className="h-12 w-full font-display text-base tracking-widest"
              >
                {busy ? "..." : "CRIAR"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------- DIRETOR / PROFESSOR --------------------- */

function TelaGestor({
  perfilId,
  ehDiretor,
}: {
  perfilId: string | undefined;
  ehDiretor: boolean;
}) {
  const { data: pessoas, isLoading, refetch } = useQuery({
    queryKey: ["organizacao", perfilId, ehDiretor],
    enabled: !!perfilId,
    queryFn: async () => {
      const coluna = ehDiretor ? "diretor_id" : "professor_id";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, role, categoria, objetivo")
        .eq(coluna, perfilId!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pessoa[];
    },
  });

  return (
    <AppShell>
      <h1 className="text-4xl">Organização</h1>
      <p className="mt-1 text-sm uppercase tracking-[0.25em] text-muted-foreground">
        {ehDiretor ? "Seus professores" : "Seus alunos"}
      </p>

      {ehDiretor ? (
        <CriarProfessor onCriado={() => refetch()} />
      ) : (
        <ConvidarAluno />
      )}

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (pessoas?.length ?? 0) === 0 && (
          <div className="surface-iron rounded-sm border border-border p-6 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {ehDiretor
                ? "Nenhum professor cadastrado ainda."
                : "Nenhum aluno vinculado a você ainda."}
            </p>
          </div>
        )}

        {pessoas?.map((p) =>
          ehDiretor ? (
            <div
              key={p.id}
              className="surface-iron flex items-center justify-between rounded-sm border border-border p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg uppercase tracking-wide">
                  {p.nome ?? "Sem nome"}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Professor
                </p>
              </div>
            </div>
          ) : (
            <Link
              key={p.id}
              to="/aluno/$alunoId"
              params={{ alunoId: p.id }}
              className="surface-iron flex min-h-[64px] items-center justify-between rounded-sm border border-border p-4 transition-colors active:bg-secondary/60"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg uppercase tracking-wide">
                  {p.nome ?? "Sem nome"}
                </p>
                <p className="truncate text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {p.categoria ?? "—"}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gold" />
            </Link>
          ),
        )}
      </div>
    </AppShell>
  );
}

function CriarProfessor({ onCriado }: { onCriado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-professor", {
        body: { nome: nome.trim(), email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      const resp = data as { senha_temporaria?: string; error?: string } | null;
      if (resp?.error) throw new Error(resp.error);
      if (!resp?.senha_temporaria) throw new Error("Resposta inválida da função");
      setSenhaGerada(resp.senha_temporaria);
      setNome("");
      setEmail("");
      onCriado();
      toast.success("Professor criado.");
    } catch (err) {
      toast.error(
        mensagemAmigavel(err instanceof Error ? err.message : "Falha ao criar professor"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setSenhaGerada(null);
          setAberto(true);
        }}
        className="mt-5 h-12 w-full font-display text-base tracking-widest"
      >
        <UserPlus className="mr-2 size-5" /> NOVO PROFESSOR
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Novo professor
            </DialogTitle>
          </DialogHeader>

          {senhaGerada ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Senha temporária (anote agora, não será exibida de novo):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-sm border border-border bg-secondary px-3 py-3 text-lg tracking-widest">
                  {senhaGerada}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(senhaGerada);
                    toast.success("Copiada.");
                  }}
                  className="flex size-12 items-center justify-center rounded-sm border border-border"
                  aria-label="Copiar senha"
                >
                  <Copy className="size-5" />
                </button>
              </div>
              <Button className="h-12 w-full" onClick={() => setAberto(false)}>
                FECHAR
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <Button
                onClick={criar}
                disabled={busy}
                className="h-12 w-full font-display text-base tracking-widest"
              >
                {busy ? "..." : "CRIAR"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConvidarAluno() {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function convidar() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("convidar-aluno", {
        body: {
          email: email.trim().toLowerCase(),
          origem: window.location.origin,
        },
      });
      if (error) throw error;
      const resp = data as { link?: string; token?: string; error?: string } | null;
      if (resp?.error) throw new Error(resp.error);
      const url =
        resp?.link ??
        (resp?.token ? `${window.location.origin}/convite/${resp.token}` : null);
      if (!url) throw new Error("Resposta inválida da função");
      setLink(url);
      setEmail("");
      toast.success("Convite enviado.");
    } catch (err) {
      toast.error(
        mensagemAmigavel(err instanceof Error ? err.message : "Falha ao convidar"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setLink(null);
          setAberto(true);
        }}
        className="mt-5 h-12 w-full font-display text-base tracking-widest"
      >
        <Mail className="mr-2 size-5" /> CONVIDAR ALUNO
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Convidar aluno
            </DialogTitle>
          </DialogHeader>

          {link ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Convite enviado por e-mail. Link direto, se precisar:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-sm border border-border bg-secondary px-3 py-3 text-sm">
                  {link}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success("Copiado.");
                  }}
                  className="flex size-12 items-center justify-center rounded-sm border border-border"
                  aria-label="Copiar link"
                >
                  <Copy className="size-5" />
                </button>
              </div>
              <Button className="h-12 w-full" onClick={() => setAberto(false)}>
                FECHAR
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail do aluno</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <Button
                onClick={convidar}
                disabled={busy}
                className="h-12 w-full font-display text-base tracking-widest"
              >
                {busy ? "..." : "ENVIAR CONVITE"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
