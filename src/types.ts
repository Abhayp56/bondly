export interface Profile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  friendCode: string;
  partnerCode: string;
  partnerName: string;
  partnerAvatarUrl: string;
  connected: boolean;
  friendSince: string;
  streakCount: number;
  roomCode?: string;
  slot?: 'user1' | 'user2';
}

export interface BingoState {
  gameActive: boolean;
  currentTurn: 'user1' | 'user2' | null;
  boardUser1: string[];
  boardUser2: string[];
  markedItems: string[];
  completedLinesUser1: number[];
  completedLinesUser2: number[];
  scores: {
    user1: number;
    user2: number;
  };
  winner: 'user1' | 'user2' | 'draw' | null;
  lastActionDesc?: string;
}

export interface RoomState {
  roomCode: string;
  user1: Profile | null;
  user2: Profile | null;
  dailySession: DailySession;
  memories: Memory[];
  timeline: FriendshipTimelineEvent[];
  bingoState?: BingoState | null;
  lastUpdated: number;
}

export type QuestionCategory = 'Friendship' | 'Fun' | 'Emotional' | 'Deep Thinking' | 'Future' | 'Random';
export type QuestionType = 'self' | 'prediction' | 'rapid_fire' | 'multiple_choice';

export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
  type: QuestionType;
  difficulty: 'Easy' | 'Medium' | 'Deep';
  options?: string[];
}

export interface DailyQuestion {
  id: string;
  questionId: string;
  text: string;
  category: QuestionCategory;
  type: QuestionType;
  difficulty: 'Easy' | 'Medium' | 'Deep';
  options?: string[];
  answeredByUser: boolean;
  answeredByPartner: boolean;
  userAnswer: string;
  partnerAnswer: string;
  userExplanation?: string;
  partnerExplanation?: string;
  userPrediction?: string; // For prediction type: User's prediction of partner's answer
  partnerPrediction?: string; // For prediction type: Partner's prediction of user's answer
  similarityScore?: number;
  aiCommentary?: string;
  unlockTime: string; // ISO string
}

export interface DailySession {
  id: string;
  date: string; // YYYY-MM-DD
  questions: DailyQuestion[];
  compatibilityScore?: number;
  aiSummary?: string;
  completedAt?: string;
  breakdown?: {
    communication: number;
    dreams: number;
    humor: number;
    emotions: number;
    lifestyle: number;
  };
}

export interface Memory {
  id: string;
  date: string;
  questionText: string;
  category: QuestionCategory;
  userAnswer: string;
  partnerAnswer: string;
  similarityScore: number;
  aiCommentary: string;
  imageUrl?: string;
}

export interface FriendshipTimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'streak' | 'match' | 'anniversary' | 'achievement' | 'milestone';
  icon: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

export interface MiniGame {
  id: string;
  type: 'this_or_that' | 'would_you_rather' | 'emoji_guess' | 'complete_sentence';
  title: string;
  question: string;
  options?: string[]; // For this_or_that / would_you_rather
  userSelection?: string;
  partnerSelection?: string;
  revealed: boolean;
  similarityScore?: number;
  aiCommentary?: string;
}
