import { Link, useNavigate } from "@tanstack/react-router";
import { Dumbbell, LogOut, User } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/treino" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-sm bg-primary">
              <Dumbbell className="size-5 text-primary-foreground" strokeWidth={2.75} />
            </span>
            <span className="font-display text-2xl tracking-widest">LEONIDAS</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/treino">Treino</Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Perfil">
              <Link to="/perfil">
                <User className="size-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut}>
              <LogOut className="size-5" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="screen-in mx-auto max-w-4xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
