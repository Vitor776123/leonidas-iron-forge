import { createClient } from "@supabase/supabase-js";

// Projeto Supabase existente "Leonidas" (chave publishable — segura no cliente)
const SUPABASE_URL = "https://jjsssfrbaogdmmhyaeyu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_64dG4CLGPRoV6LPkj3nNlA_VOT265Wy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type Profile = {
  id: string;
  user_id: string;
  nome: string;
  idade: number;
  altura_cm: number;
  peso_kg: number;
  genero: string;
  dias_por_semana: number;
  tempo_treino_meses: number;
  objetivo: string;
  categoria: string;
  foco: string;
  foco_grupo_customizado: string | null;
  imc: number | null;
  equipamentos_preferidos: string[] | null;
};

export type Exercise = {
  id: string;
  name_pt: string;
  muscle: string;
  body_part: string | null;
  equipment: string | null;
  gif_url: string | null;
  instructions_pt: string[] | null;
  dificuldade: string | null;
};

export type WorkoutExercise = {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  ordem: number;
  series: number;
  reps_min: number;
  reps_max: number;
  descanso_segundos: number;
  eh_bonus_foco: boolean;
  tecnica_avancada: string | null;
  concluido: boolean | null;
  observacao: string | null;
  tipo: string | null;
  minutos_realizados: number | null;
  calorias_realizadas: number | null;
  exercises: Exercise | null;
};

export type WorkoutDay = {
  id: string;
  ordem: number;
  rotulo: string;
  workout_exercises: WorkoutExercise[];
};
