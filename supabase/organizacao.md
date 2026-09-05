# Organização — SQL (RLS) + Edge Function

Aplique no projeto Supabase `jjsssfrbaogdmmhyaeyu`.

## 1. Políticas (SQL Editor)

```sql
-- Helpers (evitam recursão nas policies)
create or replace function public.meu_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.meu_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(role, 'aluno') from public.profiles where user_id = auth.uid() limit 1
$$;

alter table public.profiles enable row level security;

-- Próprio perfil
drop policy if exists "profiles_select_proprio" on public.profiles;
create policy "profiles_select_proprio" on public.profiles
for select to authenticated using (user_id = auth.uid());

-- Professor vê seus alunos
drop policy if exists "profiles_select_alunos" on public.profiles;
create policy "profiles_select_alunos" on public.profiles
for select to authenticated
using (public.meu_role() = 'professor' and professor_id = public.meu_profile_id());

-- Diretor vê seus professores
drop policy if exists "profiles_select_professores" on public.profiles;
create policy "profiles_select_professores" on public.profiles
for select to authenticated
using (public.meu_role() = 'diretor' and diretor_id = public.meu_profile_id());

-- Lista de professores visível para escolha no cadastro
drop policy if exists "profiles_select_lista_professores" on public.profiles;
create policy "profiles_select_lista_professores" on public.profiles
for select to authenticated using (role = 'professor');

-- Update: só o próprio perfil, ou aluno do professor
drop policy if exists "profiles_update_proprio" on public.profiles;
create policy "profiles_update_proprio" on public.profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "profiles_update_alunos" on public.profiles;
create policy "profiles_update_alunos" on public.profiles
for update to authenticated
using (public.meu_role() = 'professor' and professor_id = public.meu_profile_id());

-- Dados de treino: dono OU professor do dono
create or replace function public.pode_gerenciar_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (
        p.user_id = auth.uid()
        or (public.meu_role() = 'professor' and p.professor_id = public.meu_profile_id())
      )
  )
$$;

-- workout_plans
alter table public.workout_plans enable row level security;
drop policy if exists "planos_all" on public.workout_plans;
create policy "planos_all" on public.workout_plans
for all to authenticated
using (public.pode_gerenciar_profile(profile_id))
with check (public.pode_gerenciar_profile(profile_id));

-- peso_registros
alter table public.peso_registros enable row level security;
drop policy if exists "pesos_all" on public.peso_registros;
create policy "pesos_all" on public.peso_registros
for all to authenticated
using (public.pode_gerenciar_profile(profile_id))
with check (public.pode_gerenciar_profile(profile_id));

-- workout_days
alter table public.workout_days enable row level security;
drop policy if exists "dias_all" on public.workout_days;
create policy "dias_all" on public.workout_days
for all to authenticated
using (exists (select 1 from public.workout_plans wp
               where wp.id = workout_days.workout_plan_id
                 and public.pode_gerenciar_profile(wp.profile_id)))
with check (exists (select 1 from public.workout_plans wp
               where wp.id = workout_days.workout_plan_id
                 and public.pode_gerenciar_profile(wp.profile_id)));

-- workout_exercises
alter table public.workout_exercises enable row level security;
drop policy if exists "exercicios_all" on public.workout_exercises;
create policy "exercicios_all" on public.workout_exercises
for all to authenticated
using (exists (select 1 from public.workout_days d
               join public.workout_plans wp on wp.id = d.workout_plan_id
               where d.id = workout_exercises.workout_day_id
                 and public.pode_gerenciar_profile(wp.profile_id)))
with check (exists (select 1 from public.workout_days d
               join public.workout_plans wp on wp.id = d.workout_plan_id
               where d.id = workout_exercises.workout_day_id
                 and public.pode_gerenciar_profile(wp.profile_id)));

grant select, insert, update, delete on public.profiles, public.workout_plans,
  public.workout_days, public.workout_exercises, public.peso_registros to authenticated;
```

## 2. Edge Function `criar-professor`

Crie no painel Supabase (Edge Functions → New function → nome `criar-professor`) e cole:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function senhaTemporaria() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => a[b % a.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    const { data: diretor } = await admin
      .from("profiles").select("id, role").eq("user_id", userData.user.id).maybeSingle();
    if (!diretor || diretor.role !== "diretor")
      return json({ error: "Apenas diretores podem criar professores" }, 403);

    const { nome, email } = await req.json();
    if (!nome || !email) return json({ error: "nome e email são obrigatórios" }, 400);

    const senha = senhaTemporaria();
    const { data: criado, error: createErr } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome, role: "professor" },
    });
    if (createErr || !criado.user) throw createErr ?? new Error("Falha ao criar usuário");

    const { error: perfilErr } = await admin.from("profiles").insert({
      user_id: criado.user.id, nome, role: "professor", diretor_id: diretor.id,
    });
    if (perfilErr) {
      await admin.auth.admin.deleteUser(criado.user.id);
      throw perfilErr;
    }
    return json({ senha_temporaria: senha, email });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
```

Obs.: se a tabela `profiles` exigir campos como `idade`, `altura_cm` etc. (NOT NULL),
torne-os opcionais ou preencha valores padrão no insert acima — o professor completa
o questionário depois.
