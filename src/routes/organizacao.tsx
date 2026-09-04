import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight, Copy, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/organizacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Organização — Leonidas" },
      {
        name: "description",
        content: "Gestão de professores e alunos da sua academia no Leonidas.",
      },
      { property: "og:title", content: "Organização — Leonidas" },
      {
        property: "og:description",
        content: "Gestão de professores e alunos da sua academia no Leonidas.",
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

  const ehDiretor = role === "diretor";

  const { data: pessoas, isLoading, refetch } = useQuery({
    queryKey: ["organizacao", perfil?.id, role],
    enabled: !!perfil?.id && ehGestor,
    queryFn: async () => {
      const coluna = ehDiretor ? "diretor_id" : "professor_id";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, role, categoria, objetivo")
        .eq(coluna, perfil!.id)
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

      {ehDiretor && <CriarProfessor diretorId={perfil?.id} onCriado={() => refetch()} />}

      <div className="mt-6 space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
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

function CriarProfessor({
  diretorId,
  onCriado,
}: {
  diretorId: string | undefined;
  onCriado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function criar() {
    if (!diretorId || !nome.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-professor", {
        body: { nome: nome.trim(), email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      const senha = (data as { senha_temporaria?: string } | null)?.senha_temporaria;
      if (!senha) throw new Error("Resposta inválida da função");
      setSenhaGerada(senha);
      setNome("");
      setEmail("");
      onCriado();
      toast.success("Professor criado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar professor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        className="mt-6 h-12 w-full font-display text-lg tracking-widest"
        onClick={() => {
          setSenhaGerada(null);
          setAberto(true);
        }}
      >
        <UserPlus className="mr-1 size-5" /> NOVO PROFESSOR
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Novo professor
            </DialogTitle>
          </DialogHeader>

          {senhaGerada ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Senha temporária — copie e envie ao professor. Ela não será exibida de novo.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-sm border border-border bg-secondary px-3 py-3 font-mono text-lg tracking-widest">
                  {senhaGerada}
                </code>
                <Button
                  variant="secondary"
                  className="h-12 w-12 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(senhaGerada);
                    toast.success("Copiada.");
                  }}
                >
                  <Copy className="size-5" />
                </Button>
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
                  className="h-12"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do professor"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  className="h-12"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="professor@email.com"
                />
              </div>
              <Button
                className="h-12 w-full font-display text-lg tracking-widest"
                disabled={busy || !nome.trim() || !email.trim()}
                onClick={criar}
              >
                {busy ? <Loader2 className="mr-1 size-5 animate-spin" /> : null}
                CRIAR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
