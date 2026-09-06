import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { perfilEstaCompleto } from "@/hooks/usePerfil";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase
      .from("profiles")
      .select("id, idade, altura_cm, peso_kg, objetivo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // Em caso de erro de leitura, nunca reabrir o onboarding.
        if (error) {
          navigate({ to: "/treino", replace: true });
          return;
        }
        const row = data as Record<string, unknown> | null;
        const novo = !row || !perfilEstaCompleto(row);
        navigate({ to: novo ? "/questionario" : "/treino", replace: true });
      });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="font-display text-3xl tracking-[0.3em] text-muted-foreground">LEONIDAS</span>
    </div>
  );
}
