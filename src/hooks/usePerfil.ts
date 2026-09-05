import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Papel = "aluno" | "professor" | "diretor" | "dono";

export type PerfilBasico = {
  id: string;
  nome: string | null;
  role: Papel;
  organizacao_id: string | null;
  completo: boolean;
};

export function usePerfil() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["perfil-basico", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<PerfilBasico | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, role, organizacao_id, idade, altura_cm, peso_kg, objetivo")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row["id"] as string,
        nome: (row["nome"] as string | null) ?? null,
        role: ((row["role"] as Papel | null) ?? "aluno") as Papel,
        organizacao_id: (row["organizacao_id"] as string | null) ?? null,
        completo: perfilEstaCompleto(row),
      };
    },
  });

  const role = query.data?.role ?? "aluno";
  return {
    perfil: query.data ?? null,
    role,
    ehGestor: role === "professor" || role === "diretor" || role === "dono",
    loading: query.isLoading,
  };
}

/** Um perfil é considerado completo quando o questionário já foi respondido. */
export function perfilEstaCompleto(row: Record<string, unknown> | null | undefined) {
  if (!row) return false;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  return (
    num(row["idade"]) > 0 &&
    num(row["altura_cm"]) > 0 &&
    num(row["peso_kg"]) > 0 &&
    !!row["objetivo"]
  );
}
