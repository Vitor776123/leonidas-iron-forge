# Leonidas: Treino sem desculpas!

Prompt para o Lovable — App de Treinos "Leonidas"

Quero construir um app de treinos personalizado para uso pessoal — vou usar eu e minha esposa. O nome do projeto é Leonidas.

⚠️ Instrução técnica obrigatória — leia antes de gerar qualquer código

Não crie um banco de dados novo. Eu já tenho um projeto Supabase existente chamado "Leonidas", com todas as tabelas, políticas de segurança (RLS) e a lógica de geração de treino já prontas e testadas. Antes de escrever qualquer código:

Conecte este projeto Lovable ao meu Supabase existente usando a integração nativa "Connect Supabase" (não use o Lovable Cloud/banco automático).

Ao conectar, selecione o projeto chamado Leonidas.

Use exatamente as tabelas e a função RPC já existentes, descritas na seção "Schema do banco" mais abaixo — não recrie, não renomeie e não altere a estrutura dessas tabelas.

Se por algum motivo a conexão com esse Supabase específico não for possível nesta conversa, pare e me avise antes de prosseguir, em vez de criar um banco novo por conta própria.

Caso o fluxo de conexão peça os dados manualmente (em vez de conectar direto pela sua conta), use:

URL do projeto: https://jjsssfrbaogdmmhyaeyu.supabase.co

Anon/Publishable Key: sb_publishable_64dG4CLGPRoV6LPkj3nNlA_VOT265Wy

Sobre o produto

O app faz uma entrevista inicial com a pessoa (altura, peso, idade, frequência de treino, objetivo, etc.) e gera automaticamente um treino personalizado, com liberdade de trocar qualquer exercício por um equivalente. O banco de dados e toda a lógica de geração de treino já existem no Supabase conectado — você não precisa criar tabelas nem regras de negócio, só construir a interface e conectar nelas.

Direção visual — muito importante

Quero uma identidade visual profissional, robusta e rústica, do tipo que motiva quem treina pesado — pense em academia hardcore, não em app de bem-estar fofinho.

Paleta principal: preto como fundo dominante.

Detalhes em vermelho (para ações, destaques, alertas de intensidade) e dourado (para conquistas, categorias avançadas, elementos de prestígio/status).

Tipografia forte, com peso — nada de fontes finas ou delicadas. Títulos grandes e impactantes.

Texturas sutis (concreto, metal escovado, ferro) são bem-vindas como fundo ou detalhes, sem exagerar.

Ícones e ilustrações com traço robusto, não minimalista/fofo.

Transições suaves entre telas (fade/slide bem executados) — a navegação deve parecer fluida e premium, tipo um app de academia de verdade (referência de qualidade: Nike Training Club, Freeletics).

Ao entrar na área do treino, a visão deve ser organizada por dia, clara, fácil de escanear rapidamente antes/durante o treino (letra grande o suficiente pra ler suado, sem precisar forçar a vista).

Autenticação

Login simples (email/senha) via Supabase Auth — é só para duas pessoas usarem (eu e minha esposa), então não precisa de cadastro público aberto nem fluxo social login. Uma tela de login/cadastro básica é suficiente.

Cada pessoa tem seu próprio perfil e treino — nada é compartilhado entre os dois usuários.

Fluxo 1 — Questionário inicial (perfil)

Depois do login, se a pessoa ainda não tem um perfil, mostrar um questionário em etapas (uma pergunta por tela, com barra de progresso), coletando:

Nome

Idade

Altura (cm)

Peso (kg)

Gênero (masculino / feminino / outro)

Quantos dias por semana pretende treinar (1 a 6)

Há quanto tempo treina (em meses — usar pra ajudar a pessoa a se situar, mas quem define a categoria final é a pergunta 8)

Categoria de experiência: Iniciante / Intermediário / Intermediário Avançado / Veterano / Veterano Casca Grossa

Objetivo: Hipertrofia / Emagrecimento / Condicionamento / Força

Foco/ênfase: Glúteo e posterior / Ombros e braços / Equilibrado (sem foco específico) / Foco customizado (nesse caso, deixar escolher um grupo muscular específico numa lista)

Ao finalizar, salvar tudo na tabela profiles do Supabase (os nomes de coluna já batem com essas perguntas — consulte o schema abaixo) e, em seguida, chamar a função RPC generate_workout_plan(profile_id) do Supabase, que gera o treino inteiro sozinha no banco. Depois disso, redirecionar pra tela de treino.

Fluxo 2 — Tela de treino

Mostrar os dias do treino gerado (tabela workout_days) como abas ou lista — cada dia com seu rótulo (ex: "Superior — Dia 1").

Dentro de cada dia, listar os exercícios (workout_exercises + join com exercises) na ordem certa, mostrando: nome do exercício (em português, campo name_pt), grupo muscular, séries, faixa de repetições, tempo de descanso, e se tem técnica avançada aplicada (drop set, etc).

Ao clicar em um exercício, abrir um modal/tela de detalhe mostrando o GIF de execução (campo gif_url da tabela exercises) junto com as instruções passo a passo (instructions_pt).

Botão de trocar exercício: ao clicar, mostrar uma lista de exercícios alternativos do mesmo grupo muscular (mesma muscle na tabela exercises) para a pessoa escolher outro. Ao confirmar a troca, registrar na tabela exercise_swaps e atualizar o exercise_id do workout_exercises correspondente.

Marcar visualmente (com um ícone dourado, por exemplo) os exercícios que vieram do "bônus de foco" (eh_bonus_foco = true), pra pessoa entender por que aquele exercício extra está ali.

Fluxo 3 — Perfil / Configurações

Tela simples pra pessoa ver os dados do próprio perfil.

Botão pra refazer o questionário (gera um novo plano, chamando generate_workout_plan de novo — o plano antigo fica marcado como inativo automaticamente, não precisa se preocupar com isso).

Schema do banco (já existe, não recriar)

profiles (id, user_id, nome, idade, altura_cm, peso_kg, genero, dias_por_semana,
          tempo_treino_meses, objetivo, categoria, foco, foco_grupo_customizado, imc)

exercises (id, slug, name_en, name_es, name_pt, muscle, body_part, equipment, category,
           secondary_muscles[], instructions_en[], instructions_es[], instructions_pt[],
           gif_url, dificuldade, descricao_objetivo, baixo_impacto)

workout_plans (id, profile_id, split_type, ativo)
workout_days (id, workout_plan_id, ordem, rotulo)
workout_exercises (id, workout_day_id, exercise_id, ordem, series, reps_min, reps_max,
                    descanso_segundos, eh_bonus_foco, tecnica_avancada)
exercise_swaps (id, workout_exercise_id, exercise_original_id, exercise_novo_id)


Função RPC pronta: generate_workout_plan(p_profile_id uuid) returns uuid

Todas as tabelas já têm RLS habilitado — cada usuário só acessa o próprio perfil e treino automaticamente, não precisa reimplementar essa lógica de segurança.

Resumo do que preciso que você construa

Conectar ao Supabase existente "Leonidas" (não criar banco novo)

Tela de login/cadastro

Questionário em etapas que salva o perfil e gera o treino

Tela de treino organizada por dia, com clique abrindo GIF + instruções, e opção de trocar exercício

Tela de perfil/configurações com opção de refazer o questionário

Identidade visual: preto + vermelho + dourado, robusta e motivacional, com transições suaves entre todas as telas

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://leonidas-iron-forge.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ddda45a5-88d5-4765-b2e1-360d5bf96c62).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
