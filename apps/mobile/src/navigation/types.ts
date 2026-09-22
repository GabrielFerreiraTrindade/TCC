import type { Difficulty, QuizMode } from "@studyquest/shared";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  Quiz: { trackSlug: string; mode: QuizMode; difficulty: Difficulty | null };
  Results: {
    trackSlug: string;
    mode: QuizMode;
    totalPoints: number;
    correctCount: number;
    questionsCount: number;
    recommendedLevel: Difficulty;
  };
  Profile: undefined;
};
