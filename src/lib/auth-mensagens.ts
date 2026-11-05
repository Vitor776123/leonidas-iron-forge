import { supabase } from "@/integrations/supabase/client";

export function traduzErroAuth(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = (e?.message ?? "").toLowerCase();
  const code = (e?.code ?? "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("email not confirmed") || code === "email_not_confirmed")
    return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("already registered") || code === "user_already_exists")
    return "Este e-mail já tem uma conta. Entre com sua senha.";
  if (msg.includes("password") && (msg.includes("6") || msg.includes("short") || msg.includes("least")))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (
    e?.status === 429 ||
    msg.includes("rate limit") ||
    code.includes("rate_limit") ||
    msg.includes("too many")
  )
    return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return "Não foi possível concluir. Tente novamente.";
}

export async function reenviarConfirmacao(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}
