// Edge Function: gera um lote de perguntas com o Gemini, valida cada uma de forma
// independente, e só grava com status "active" as aprovadas. Chamada pelo app quando
// get_practice_questions/get_diagnostic_questions sinalizam low_inventory — não gera
// pergunta em tempo real durante o quiz, só repõe o estoque para a próxima vez.
//
// Requer os secrets GEMINI_API_KEY (obrigatório) e GEMINI_MODEL (opcional, default
// abaixo) configurados no projeto Supabase: `supabase secrets set GEMINI_API_KEY=...`.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildGenerationPrompt, buildValidationPrompt } from "./prompts.ts";
import { GENERATION_SCHEMA, VALIDATION_SCHEMA } from "./schemas.ts";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_DIFFICULTIES = ["iniciante", "intermediario", "avancado"];
const VALID_LOCALES = ["pt", "en"];
const FORBIDDEN_OPTION_PATTERN = /todas as anteriores|nenhuma das anteriores|all of the above|none of the above/i;

interface GeneratedOption {
  id: string;
  text: string;
  explanation: string;
}

interface GeneratedQuestion {
  category: string;
  prompt: string;
  options: GeneratedOption[];
  correct_option_id: string;
  time_limit_seconds: number;
}

interface ValidationResult {
  verified_correct_option_id: string;
  matches_claimed_answer: boolean;
  approved: boolean;
  issues: string[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }
  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "GEMINI_API_KEY não configurada nos secrets do projeto" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "não autenticado" }, 401);
  }

  let body: { trackId?: string; difficulty?: string; locale?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "corpo da requisição inválido" }, 400);
  }

  const trackId = body.trackId;
  const difficulty = body.difficulty ?? "";
  const locale = body.locale ?? "pt";
  const count = body.count ?? 10;

  if (!trackId || !VALID_DIFFICULTIES.includes(difficulty) || !VALID_LOCALES.includes(locale)) {
    return jsonResponse({ error: "parâmetros inválidos (trackId, difficulty, locale)" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData } = await supabaseAsCaller.auth.getUser();
  const requestedBy = userData?.user?.id ?? null;
  if (!requestedBy) {
    return jsonResponse({ error: "token inválido" }, 401);
  }

  const { data: track, error: trackError } = await supabaseAdmin
    .from("tracks")
    .select("id, name, description")
    .eq("id", trackId)
    .single();
  if (trackError || !track) {
    return jsonResponse({ error: "trilha não encontrada" }, 404);
  }

  const { data: categoryRows } = await supabaseAdmin.from("categories").select("name").eq("track_id", trackId);
  const { data: existingRows } = await supabaseAdmin
    .from("questions")
    .select("prompt")
    .eq("track_id", trackId)
    .eq("difficulty", difficulty)
    .eq("locale", locale)
    .limit(40);

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("question_generation_batches")
    .insert({
      track_id: trackId,
      difficulty,
      locale,
      requested_by: requestedBy,
      model: GEMINI_MODEL,
      questions_requested: count,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return jsonResponse({ error: "falha ao criar registro do lote" }, 500);
  }

  try {
    const { systemInstruction, userPrompt } = buildGenerationPrompt({
      trackName: track.name,
      trackDescription: track.description,
      difficulty,
      locale,
      count,
      categories: (categoryRows ?? []).map((c) => c.name),
      existingPrompts: (existingRows ?? []).map((q) => q.prompt),
    });

    const generation = await callGemini<{ questions: GeneratedQuestion[] }>(
      systemInstruction,
      userPrompt,
      GENERATION_SCHEMA,
    );
    const candidates = (generation.questions ?? []).filter(isStructurallyValid);

    let approvedCount = 0;
    for (const question of candidates) {
      const validation = await validateQuestion(track.name, difficulty, locale, question);
      const approved = validation.approved && validation.matches_claimed_answer;

      const categoryId = await resolveCategoryId(supabaseAdmin, trackId, question.category);
      const optionExplanations: Record<string, string> = {};
      for (const option of question.options) optionExplanations[option.id] = option.explanation;

      const { error: insertError } = await supabaseAdmin.from("questions").insert({
        track_id: trackId,
        category_id: categoryId,
        difficulty,
        locale,
        prompt: question.prompt,
        options: question.options.map((o) => ({ id: o.id, text: o.text })),
        correct_option_id: question.correct_option_id,
        option_explanations: optionExplanations,
        time_limit_seconds: question.time_limit_seconds,
        status: approved ? "active" : "rejected",
        source: "ai_generated",
        generation_batch_id: batch.id,
      });

      if (!insertError && approved) approvedCount += 1;
    }

    await supabaseAdmin
      .from("question_generation_batches")
      .update({
        questions_generated: candidates.length,
        questions_approved: approvedCount,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return jsonResponse({ batchId: batch.id, generated: candidates.length, approved: approvedCount }, 200);
  } catch (error) {
    await supabaseAdmin
      .from("question_generation_batches")
      .update({ status: "failed", error: String(error), completed_at: new Date().toISOString() })
      .eq("id", batch.id);
    return jsonResponse({ error: "falha ao gerar lote", detail: String(error) }, 500);
  }
});

function isStructurallyValid(question: GeneratedQuestion): boolean {
  if (!question.prompt || !Array.isArray(question.options) || question.options.length !== 4) return false;
  const ids = question.options.map((option) => option.id);
  if (new Set(ids).size !== 4) return false;
  if (!ids.includes(question.correct_option_id)) return false;
  if (question.options.some((option) => FORBIDDEN_OPTION_PATTERN.test(option.text))) return false;
  if (!question.time_limit_seconds || question.time_limit_seconds <= 0) return false;
  return true;
}

async function validateQuestion(
  trackName: string,
  difficulty: string,
  locale: string,
  question: GeneratedQuestion,
): Promise<ValidationResult> {
  const { systemInstruction, userPrompt } = buildValidationPrompt({
    trackName,
    difficulty,
    locale,
    question: {
      prompt: question.prompt,
      options: question.options,
      correct_option_id: question.correct_option_id,
    },
  });
  return callGemini<ValidationResult>(systemInstruction, userPrompt, VALIDATION_SCHEMA);
}

async function resolveCategoryId(
  supabaseAdmin: SupabaseClient,
  trackId: string,
  categoryName: string,
): Promise<string | null> {
  if (!categoryName) return null;

  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("track_id", trackId)
    .ilike("name", categoryName)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabaseAdmin
    .from("categories")
    .insert({ track_id: trackId, name: categoryName })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function callGemini<T>(systemInstruction: string, userPrompt: string, schema: unknown): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API respondeu ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta do Gemini sem conteúdo de texto");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta do Gemini não é JSON válido: ${text.slice(0, 500)}`);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
