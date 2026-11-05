import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reenviarConfirmacao, traduzErroAuth } from "@/lib/auth-mensagens";

export function ReenviarBotao({
  email,
  label = "REENVIAR E-MAIL",
  variant = "secondary",
  iniciarEspera = false,
}: {
  email: string;
  label?: string;
  variant?: "default" | "secondary";
  iniciarEspera?: boolean;
}) {
  const [espera, setEspera] = useState(iniciarEspera ? 60 : 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviar() {
    if (!email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    try {
      await reenviarConfirmacao(email);
      toast.success("E-mail de confirmação reenviado.");
      setEspera(60);
    } catch (err) {
      toast.error(traduzErroAuth(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={busy || espera > 0}
      onClick={enviar}
      className="h-12 w-full font-display text-base tracking-widest"
    >
      {busy ? "..." : espera > 0 ? `AGUARDE ${espera}s` : label}
    </Button>
  );
}
