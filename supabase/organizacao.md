# Organização / Plataforma — Edge Functions

Aplique no projeto Supabase `jjsssfrbaogdmmhyaeyu` (Edge Functions → New function).
O banco (roles, hierarquia, `organizacoes`, `convites`, limites e triggers) já está pronto.

Trecho comum a todas as funções:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

export function senhaTemporaria() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => a[b % a.length]).join("");
}

export function amigavel(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("limite") && m.includes("professor")) return "Limite de professores atingido para esta academia";
  if (m.includes("limite") && m.includes("aluno")) return "Limite de alunos atingido para esta academia";
  return msg;
}
```

(Se preferir, copie esse bloco no topo de cada função em vez de compartilhar arquivo.)

## 1. `criar-professor`

Autoriza quem é **diretor da organização** — seja `role='diretor'` ou `role='dono'`
que também é `organizacoes.diretor_id`.

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const db = admin();
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const { data: me } = await db.from("profiles")
      .select("id, role, organizacao_id").eq("user_id", u.user.id).maybeSingle();
    if (!me) return json({ error: "Perfil não encontrado" }, 403);

    const { nome, email, organizacao_id } = await req.json();
    const orgId = organizacao_id ?? me.organizacao_id;
    if (!nome || !email || !orgId) return json({ error: "nome, email e organização são obrigatórios" }, 400);

    const { data: org } = await db.from("organizacoes")
      .select("id, diretor_id").eq("id", orgId).maybeSingle();
    // autorização: é o diretor_id da organização (dono agindo como diretor também passa)
    const autorizado = !!org && org.diretor_id === me.id;
    if (!autorizado) return json({ error: "Sem permissão para esta academia" }, 403);

    const senha = senhaTemporaria();
    const { data: criado, error: e1 } = await db.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome, role: "professor" },
    });
    if (e1 || !criado.user) return json({ error: amigavel(e1?.message ?? "Falha ao criar usuário") }, 400);

    const { error: e2 } = await db.from("profiles").insert({
      user_id: criado.user.id, nome, role: "professor",
      diretor_id: me.id, organizacao_id: orgId,
    });
    if (e2) {
      await db.auth.admin.deleteUser(criado.user.id);
      return json({ error: amigavel(e2.message) }, 400); // trigger de limite cai aqui
    }
    return json({ senha_temporaria: senha, email });
  } catch (err) {
    return json({ error: amigavel(err instanceof Error ? err.message : "Erro inesperado") }, 500);
  }
});
```

## 2. `criar-diretor` (dono cria academia + diretor)

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const db = admin();
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const { data: dono } = await db.from("profiles")
      .select("id, role").eq("user_id", u.user.id).maybeSingle();
    if (!dono || dono.role !== "dono") return json({ error: "Apenas o dono da plataforma" }, 403);

    const { nome_academia, nome, email, logo_url, cor_primaria, cor_secundaria } = await req.json();
    if (!nome_academia || !nome || !email) return json({ error: "Campos obrigatórios faltando" }, 400);

    const senha = senhaTemporaria();
    const { data: criado, error: e1 } = await db.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome, role: "diretor" },
    });
    if (e1 || !criado.user) return json({ error: e1?.message ?? "Falha ao criar usuário" }, 400);

    const { data: perfil, error: e2 } = await db.from("profiles")
      .insert({ user_id: criado.user.id, nome, role: "diretor" })
      .select("id").single();
    if (e2 || !perfil) {
      await db.auth.admin.deleteUser(criado.user.id);
      return json({ error: amigavel(e2?.message ?? "Falha ao criar perfil") }, 400);
    }

    const { data: org, error: e3 } = await db.from("organizacoes").insert({
      nome_exibicao: nome_academia,
      logo_url: logo_url ?? null,
      cor_primaria: cor_primaria ?? "#E11D2A",
      cor_secundaria: cor_secundaria ?? "#000000",
      diretor_id: perfil.id,
      criado_por_dono_id: dono.id,
    }).select("id").single();
    if (e3 || !org) {
      await db.from("profiles").delete().eq("id", perfil.id);
      await db.auth.admin.deleteUser(criado.user.id);
      return json({ error: e3?.message ?? "Falha ao criar academia" }, 400);
    }

    await db.from("profiles").update({ organizacao_id: org.id }).eq("id", perfil.id);
    return json({ senha_temporaria: senha, email, organizacao_id: org.id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
```

## 3. `convidar-aluno` (professor)

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const db = admin();
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const { data: prof } = await db.from("profiles")
      .select("id, role, organizacao_id").eq("user_id", u.user.id).maybeSingle();
    if (!prof || !["professor", "diretor", "dono"].includes(prof.role ?? ""))
      return json({ error: "Apenas professores podem convidar" }, 403);

    const { email, origem } = await req.json();
    if (!email) return json({ error: "email é obrigatório" }, 400);

    const convToken = crypto.randomUUID();
    const expira = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await db.from("convites").insert({
      email, token: convToken, professor_id: prof.id,
      organizacao_id: prof.organizacao_id, status: "pendente", expires_at: expira,
    });
    if (error) return json({ error: amigavel(error.message) }, 400);

    const link = `${origem ?? ""}/convite/${convToken}`;
    // Envio do e-mail (Resend). Configure o secret RESEND_API_KEY na função.
    const key = Deno.env.get("RESEND_API_KEY");
    if (key) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Leonidas <onboarding@resend.dev>",
          to: [email],
          subject: "Seu convite para treinar",
          html: `<p>Você foi convidado para treinar.</p><p><a href="${link}">Criar minha conta</a></p>`,
        }),
      });
    }
    return json({ token: convToken, link });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
```

## 4. `validar-convite` (pública, sem JWT)

Marque a função como pública (`--no-verify-jwt`).

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const db = admin();
  const { token } = await req.json();
  const { data: c } = await db.from("convites")
    .select("id, email, status, expires_at, organizacao_id").eq("token", token).maybeSingle();
  if (!c || c.status !== "pendente" || (c.expires_at && new Date(c.expires_at) < new Date()))
    return json({ valido: false, error: "Convite inválido ou expirado." });
  const { data: org } = c.organizacao_id
    ? await db.from("organizacoes").select("nome_exibicao").eq("id", c.organizacao_id).maybeSingle()
    : { data: null };
  return json({ valido: true, email: c.email, academia: org?.nome_exibicao ?? null });
});
```

## 5. `aceitar-convite` (pública, sem JWT)

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const db = admin();
  try {
    const { token, nome, senha } = await req.json();
    if (!token || !nome || !senha || senha.length < 6) return json({ error: "Dados inválidos" }, 400);

    const { data: c } = await db.from("convites")
      .select("id, email, status, expires_at, professor_id, organizacao_id")
      .eq("token", token).maybeSingle();
    if (!c || c.status !== "pendente" || (c.expires_at && new Date(c.expires_at) < new Date()))
      return json({ error: "Convite inválido ou expirado." }, 400);

    const { data: criado, error: e1 } = await db.auth.admin.createUser({
      email: c.email, password: senha, email_confirm: true,
      user_metadata: { nome, role: "aluno" },
    });
    if (e1 || !criado.user) return json({ error: e1?.message ?? "Falha ao criar conta" }, 400);

    const { data: perfil, error: e2 } = await db.from("profiles").insert({
      user_id: criado.user.id, nome, role: "aluno",
      professor_id: c.professor_id, organizacao_id: c.organizacao_id,
    }).select("id").single();
    if (e2 || !perfil) {
      await db.auth.admin.deleteUser(criado.user.id);
      // trigger de limite de alunos cai aqui; convite continua "pendente"
      return json({ error: amigavel(e2?.message ?? "Falha ao criar perfil") }, 400);
    }

    await db.from("convites").update({
      status: "aceito", aluno_profile_id: perfil.id, aceito_em: new Date().toISOString(),
    }).eq("id", c.id);

    return json({ ok: true });
  } catch (err) {
    return json({ error: amigavel(err instanceof Error ? err.message : "Erro inesperado") }, 500);
  }
});
```

## 6. RLS extra necessária

```sql
-- leitura da marca da própria organização
alter table public.organizacoes enable row level security;
drop policy if exists "org_select_propria" on public.organizacoes;
create policy "org_select_propria" on public.organizacoes
for select to authenticated using (
  id = (select organizacao_id from public.profiles where user_id = auth.uid() limit 1)
  or criado_por_dono_id = public.meu_profile_id()
);

-- dono edita marca e limites das academias que criou
drop policy if exists "org_update_dono" on public.organizacoes;
create policy "org_update_dono" on public.organizacoes
for update to authenticated
using (criado_por_dono_id = public.meu_profile_id())
with check (criado_por_dono_id = public.meu_profile_id());

grant select, update on public.organizacoes to authenticated;
```

> O perfil criado pelo convite nasce sem idade/altura/peso; se essas colunas forem
> NOT NULL, torne-as opcionais — o aluno preenche no questionário logo após entrar.
