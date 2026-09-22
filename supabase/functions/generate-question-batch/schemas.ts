// Schemas de saída estruturada da API do Gemini (formato OpenAPI simplificado,
// tipos em maiúsculo, como a API exige em generationConfig.responseSchema).

export const GENERATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          prompt: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                text: { type: "STRING" },
                explanation: { type: "STRING" },
              },
              required: ["id", "text", "explanation"],
            },
          },
          correct_option_id: { type: "STRING" },
          time_limit_seconds: { type: "INTEGER" },
        },
        required: ["category", "prompt", "options", "correct_option_id", "time_limit_seconds"],
      },
    },
  },
  required: ["questions"],
};

export const VALIDATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    verified_correct_option_id: { type: "STRING" },
    matches_claimed_answer: { type: "BOOLEAN" },
    approved: { type: "BOOLEAN" },
    issues: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["verified_correct_option_id", "matches_claimed_answer", "approved", "issues"],
};
