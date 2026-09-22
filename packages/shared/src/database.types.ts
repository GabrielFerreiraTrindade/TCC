/**
 * Tipos das tabelas do Supabase (espelham supabase/migrations/0001_init.sql).
 * Mantidos manualmente; se preferir, substitua por `supabase gen types typescript`
 * apontando para o projeto real.
 */
/** Formato de cada pergunta dentro do jsonb retornado por get_practice_questions/get_diagnostic_questions. */
export interface RpcQuestionRow {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  time_limit_seconds: number;
  difficulty: string;
}

export interface Database {
  public: {
    Tables: {
      tracks: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tracks"]["Row"]> & { slug: string; name: string };
        Update: Partial<Database["public"]["Tables"]["tracks"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          track_id: string;
          name: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & { track_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      questions: {
        // A partir da migration 0003, o cliente nunca faz SELECT direto nesta tabela
        // (revogado) — só via get_practice_questions/get_diagnostic_questions/
        // submit_quiz_answer (SECURITY DEFINER). Este Row reflete o schema real, útil
        // só para uma eventual ferramenta administrativa com a service_role key.
        Row: {
          id: string;
          track_id: string;
          category_id: string | null;
          difficulty: string;
          prompt: string;
          options: { id: string; text: string }[];
          correct_option_id: string;
          option_explanations: Record<string, string> | null;
          time_limit_seconds: number;
          locale: string;
          status: string;
          source: string;
          generation_batch_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["questions"]["Row"]> & {
          track_id: string;
          difficulty: string;
          prompt: string;
          options: { id: string; text: string }[];
          correct_option_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          total_points: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; username: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          id: string;
          user_id: string;
          track_id: string;
          mode: string;
          difficulty: string | null;
          started_at: string;
          finished_at: string | null;
          total_points: number;
          questions_count: number;
          correct_count: number;
        };
        Insert: Partial<Database["public"]["Tables"]["quiz_sessions"]["Row"]> & {
          user_id: string;
          track_id: string;
          mode: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_sessions"]["Row"]>;
        Relationships: [];
      };
      quiz_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          selected_option_id: string;
          is_correct: boolean;
          time_taken_ms: number;
          points_awarded: number;
          answered_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["quiz_answers"]["Row"]> & {
          session_id: string;
          question_id: string;
          selected_option_id: string;
          is_correct: boolean;
          time_taken_ms: number;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_answers"]["Row"]>;
        Relationships: [];
      };
      user_track_levels: {
        Row: {
          user_id: string;
          track_id: string;
          level: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_track_levels"]["Row"]> & {
          user_id: string;
          track_id: string;
          level: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_track_levels"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_quiz_answer: {
        Args: {
          p_session_id: string;
          p_question_id: string;
          p_selected_option_id: string;
          p_time_taken_ms: number;
        };
        Returns: {
          is_correct: boolean;
          points_awarded: number;
          correct_option_id: string;
          option_explanations: Record<string, string> | null;
        }[];
      };
      get_practice_questions: {
        Args: {
          p_track_id: string;
          p_difficulty: string;
          p_locale?: string;
          p_count?: number;
        };
        Returns: {
          questions: RpcQuestionRow[];
          low_inventory: boolean;
        }[];
      };
      get_diagnostic_questions: {
        Args: {
          p_track_id: string;
          p_locale?: string;
          p_count_per_level?: number;
        };
        Returns: {
          questions: RpcQuestionRow[];
        }[];
      };
      report_question: {
        Args: {
          p_question_id: string;
          p_reason: string;
          p_detail?: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
