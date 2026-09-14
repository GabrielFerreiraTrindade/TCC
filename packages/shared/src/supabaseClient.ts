import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type StudyQuestClient = SupabaseClient<Database>;

export interface CreateSupabaseClientArgs {
  url: string;
  anonKey: string;
  /** Web usa localStorage (padrão do supabase-js); React Native precisa de um adapter (AsyncStorage). */
  storage?: SupabaseClientOptions<"public">["auth"] extends infer Auth
    ? Auth extends { storage?: infer S }
      ? S
      : never
    : never;
}

/**
 * Fábrica única usada por web e mobile, cada um passando seu próprio
 * adapter de armazenamento de sessão (localStorage no browser,
 * AsyncStorage no Expo).
 */
export function createSupabaseClient({ url, anonKey, storage }: CreateSupabaseClientArgs): StudyQuestClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: storage === undefined,
    },
  });
}
