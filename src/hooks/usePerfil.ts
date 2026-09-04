import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Papel = "aluno" | "professor" | "diretor";

export type PerfilBasico = {
  id: string;
  nome: string | null;
  role: Papel;
};

export function usePerfil() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["perfil-basico", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PerfilBasico | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        nome: (data.nome as string | null) ?? null,
        role: ((data.role as Papel | null) ?? "aluno") as Papel,
      };
    },
  });

  const role = query.data?.role ?? "aluno";
  return {
    perfil: query.data ?? null,
    role,
    ehGestor: role === "professor" || role === "diretor",
    loading: query.isLoading,
  };
}
