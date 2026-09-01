import { Link, useNavigate } from "@tanstack/react-router";
import { Dumbbell, LogOut, TrendingUp, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import helmetAsset from "@/assets/leonidas_helmet.png.asset.json";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({
  children,
  bottomBar,
  headerLeft,
}: {
  children: ReactNode;
  bottomBar?: ReactNode;
  headerLeft?: ReactNode;
}) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-4 py-2">
          {headerLeft ?? <span />}
          <Link to="/treino" className="flex min-w-0 items-center gap-2">
            <img
              src={helmetAsset.url}
              alt="Leonidas"
              className="size-9 shrink-0 object-contain"
            />
            <span className="truncate font-display text-xl tracking-[0.2em]">LEONIDAS</span>
          </Link>
          <button
            onClick={signOut}
            aria-label="Sair"
            className="flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors active:bg-secondary"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="screen-in mx-auto w-full max-w-2xl px-4 pb-40 pt-5">{children}</main>

      <div className="fixed inset-x-0 bottom-0 z-50">
        {bottomBar}
        <nav className="border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-3">
            <TabLink to="/treino" icon={<Dumbbell className="size-6" />} label="Treino" />
            <TabLink to="/progresso" icon={<TrendingUp className="size-6" />} label="Progresso" />
            <TabLink to="/perfil" icon={<User className="size-6" />} label="Perfil" />
          </div>
        </nav>
      </div>
    </div>
  );
}

function TabLink({
  to,
  icon,
  label,
}: {
  to: "/treino" | "/progresso" | "/perfil";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-primary" }}
      inactiveProps={{ className: "text-muted-foreground" }}
      className="flex min-h-[60px] flex-col items-center justify-center gap-1 font-display text-xs uppercase tracking-[0.2em] transition-colors active:bg-secondary/60"
    >
      {icon}
      {label}
    </Link>
  );
}
