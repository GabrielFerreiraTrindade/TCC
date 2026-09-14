import { createSupabaseClient, type StudyQuestClient } from "@studyquest/shared";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/web/.env.local (veja .env.local.example).",
  );
}

// No browser, storage fica indefinido de propósito: o supabase-js usa localStorage por padrão.
export const supabase: StudyQuestClient = createSupabaseClient({ url, anonKey });
