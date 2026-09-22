// Prompts de geração e validação de perguntas por IA.
// Regras de qualidade pedidas: distratores plausíveis (erros/confusões reais do assunto,
// nunca absurdos), alternativas com tamanho/estrutura parecidos, a correta não repete
// palavras exclusivas do enunciado, proibido "todas/nenhuma das anteriores", e uma
// explicação específica por alternativa (certa e erradas).

const DIFFICULTY_LABEL: Record<string, string> = {
  iniciante: "iniciante",
  intermediario: "intermediário",
  avancado: "avançado",
};

const LOCALE_LABEL: Record<string, string> = { pt: "português", en: "inglês" };

export interface GenerationPromptArgs {
  trackName: string;
  trackDescription: string | null;
  difficulty: string;
  locale: string;
  count: number;
  categories: string[];
  existingPrompts: string[];
}

export function buildGenerationPrompt(args: GenerationPromptArgs): { systemInstruction: string; userPrompt: string } {
  const nivel = DIFFICULTY_LABEL[args.difficulty] ?? args.difficulty;
  const idioma = LOCALE_LABEL[args.locale] ?? args.locale;
  const categoriasTexto = args.categories.length > 0 ? args.categories.join(", ") : "(nenhuma categoria cadastrada ainda — crie uma apropriada)";
  const existentesTexto =
    args.existingPrompts.length > 0
      ? args.existingPrompts.map((p) => `- ${p}`).join("\n")
      : "(nenhuma pergunta existente ainda neste tema/nível/idioma)";

  const systemInstruction = `Você é um elaborador de itens de avaliação especialista em "${args.trackName}"${
    args.trackDescription ? ` (${args.trackDescription})` : ""
  }, escrevendo para um app de estudos que prepara pessoas para certificações técnicas. Sua tarefa é criar
perguntas de múltipla escolha NOVAS, nível "${nivel}", no idioma ${idioma}.

Regras obrigatórias, sem exceção:
1. Cada pergunta tem exatamente 4 alternativas, sendo só 1 correta. Use "a", "b", "c", "d" como id de cada uma.
2. Os distratores (alternativas erradas) devem ser baseados em erros e confusões reais e comuns
   sobre o assunto — coisas que alguém que estudou superficialmente erraria. Nunca invente uma
   alternativa absurda, de outro assunto, ou claramente descartável.
3. As 4 alternativas devem ter tamanho, estrutura gramatical e nível de detalhe parecidos entre
   si. Não deixe a correta visivelmente mais longa, mais específica ou mais bem escrita que as
   outras — isso entrega a resposta sem o aluno saber o conteúdo.
4. A alternativa correta não pode repetir palavras ou termos do enunciado que as outras
   alternativas não repetem (isso também entrega a resposta).
5. Proibido usar "todas as anteriores", "nenhuma das anteriores" ou variações, em qualquer idioma.
6. Para cada uma das 4 alternativas, escreva uma explicação curta e específica: por que está
   certa (para a correta) ou por que está errada especificamente (para cada distrator — não uma
   explicação genérica, mas o motivo daquele erro específico).
7. Não repita, nem de forma reformulada, nenhuma das perguntas já existentes listadas abaixo.
8. "category" deve ser uma das categorias existentes listadas abaixo sempre que uma se aplicar;
   só crie um nome novo se nenhuma existente couber.
9. "time_limit_seconds" deve ser compatível com o nível: ~20-25 para iniciante, ~35-40 para
   intermediário, ~45-50 para avançado.
10. Todo o texto (pergunta, alternativas, explicações) deve estar em ${idioma}.

Categorias existentes nesse tema: ${categoriasTexto}

Perguntas já existentes nesse tema/nível/idioma (não repita o conteúdo, nem de forma reformulada):
${existentesTexto}

Responda gerando exatamente ${args.count} perguntas seguindo o formato estruturado definido.`;

  const userPrompt = `Gere ${args.count} perguntas de nível "${nivel}" sobre "${args.trackName}", em ${idioma}.`;

  return { systemInstruction, userPrompt };
}

export interface ValidationPromptArgs {
  trackName: string;
  difficulty: string;
  locale: string;
  question: {
    prompt: string;
    options: { id: string; text: string; explanation: string }[];
    correct_option_id: string;
  };
}

export function buildValidationPrompt(args: ValidationPromptArgs): { systemInstruction: string; userPrompt: string } {
  const nivel = DIFFICULTY_LABEL[args.difficulty] ?? args.difficulty;
  const idioma = LOCALE_LABEL[args.locale] ?? args.locale;

  const systemInstruction = `Você é um revisor técnico especialista em "${args.trackName}", verificando a qualidade de uma
pergunta de múltipla escolha nível "${nivel}" (idioma: ${idioma}) antes dela entrar em um app de estudos de verdade.

Primeiro, resolva a pergunta você mesmo, de forma independente, sem se deixar influenciar pela alternativa que
veio marcada como correta no JSON de entrada. Determine qual alternativa VOCÊ acha correta
("verified_correct_option_id").

Depois, avalie a pergunta contra estas regras:
1. A alternativa marcada como correta no JSON de entrada está de fato correta (compare com a sua própria resposta
   e preencha "matches_claimed_answer").
2. Os distratores são baseados em confusões plausíveis e reais do assunto — não são absurdos,
   óbvios ou de outro tema.
3. As 4 alternativas têm tamanho e nível de detalhe parecidos (nenhuma muito mais longa/curta
   ou muito mais específica que as outras).
4. A alternativa correta não repete palavras do enunciado que as outras não repetem.
5. Nenhuma alternativa é "todas as anteriores" / "nenhuma das anteriores" (em qualquer idioma).
6. Cada explicação realmente justifica aquela alternativa específica (não é genérica).

Preencha "approved" como true só se TODAS as regras passarem. Liste em "issues" cada regra violada
(vazio se aprovada). Responda no formato estruturado definido, sem exceções.`;

  const userPrompt = `Pergunta a revisar:\n${JSON.stringify(args.question, null, 2)}`;

  return { systemInstruction, userPrompt };
}
