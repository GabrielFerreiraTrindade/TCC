/**
 * Tipos das tabelas do Supabase (espelham supabase/migrations/0001_init.sql).
 * Mantidos manualmente; se preferir, substitua por `supabase gen types typescript`
 * apontando para o projeto real.
 */
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
        Row: {
          id: string;
          track_id: string;
          category_id: string | null;
          difficulty: string;
          prompt: string;
          options: { id: string; text: string }[];
          correct_option_id: string;
          explanation: string | null;
          time_limit_seconds: number;
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
          explanation: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
