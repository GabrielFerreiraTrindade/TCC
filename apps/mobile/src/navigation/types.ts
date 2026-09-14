import type { Difficulty, QuizMode } from "@studyquest/shared";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  Quiz: { mode: QuizMode; difficulty: Difficulty | null };
  Results: {
    mode: QuizMode;
    totalPoints: number;
    correctCount: number;
    questionsCount: number;
    recommendedLevel: Difficulty;
  };
  Profile: undefined;
};
