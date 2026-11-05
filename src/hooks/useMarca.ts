import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { hexParaRgb, limitarLuminosidade, rgbParaHex } from "@/lib/cores";

export type Marca = {
  id: string;
  nome_exibicao: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Busca a marca (white-label) da organização do usuário logado e aplica
 * as cores como CSS variables. Sem organização, mantém o tema padrão.
 */
export function useMarca() {
  const { perfil } = usePerfil();
  const orgId = perfil?.organizacao_id ?? null;

  const { data } = useQuery({
    queryKey: ["marca", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Marca | null> => {
      const { data, error } = await supabase
        .from("organizacoes")
        .select("id, nome_exibicao, logo_url, cor_primaria, cor_secundaria")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Marca | null) ?? null;
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const primaria = data?.cor_primaria ?? null;
    const secundaria = data?.cor_secundaria ?? null;

    if (primaria && HEX.test(primaria)) {
      root.style.setProperty("--primary", primaria);
      root.style.setProperty("--ring", primaria);
      root.style.setProperty("--sidebar-primary", primaria);
      // luzes do fundo animado: o tom da academia, sem ficar escuro demais para aparecer
      const rgb = hexParaRgb(primaria);
      if (rgb) {
        const [r, g, b] = limitarLuminosidade(rgb, 0.4, 0.75);
        root.style.setProperty("--fx-rgb", `${r}, ${g}, ${b}`);
      }
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--fx-rgb");
    }

    if (secundaria && HEX.test(secundaria)) {
      // o tema é escuro: uma cor de fundo clara é escurecida (mantém o matiz) para o brilho funcionar
      const rgb = hexParaRgb(secundaria);
      root.style.setProperty(
        "--background",
        rgb ? rgbParaHex(limitarLuminosidade(rgb, 0, 0.1)) : secundaria,
      );
    } else {
      root.style.removeProperty("--background");
    }
  }, [data?.cor_primaria, data?.cor_secundaria]);

  return {
    marca: data ?? null,
    nomeMarca: data?.nome_exibicao ?? null,
    logoUrl: data?.logo_url || null,
  };
}
