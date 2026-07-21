import { Question, Achievement, FriendshipTimelineEvent } from './types';

export const DEFAULT_QUESTIONS: Question[] = [
  // Friendship
  {
    id: 'f1',
    text: 'What was your first impression of me when we first met, and how has it changed?',
    category: 'Friendship',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 'f2',
    text: 'What is my greatest strength that I often underestimate in myself?',
    category: 'Friendship',
    type: 'prediction',
    difficulty: 'Medium',
  },
  {
    id: 'f3',
    text: 'If we could start a business together tomorrow, what would we sell?',
    category: 'Friendship',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 'f4',
    text: 'What is our funniest shared memory that never fails to make you laugh?',
    category: 'Friendship',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 'f5',
    text: 'When was a moment you felt incredibly proud of our relationship?',
    category: 'Friendship',
    type: 'self',
    difficulty: 'Medium',
  },

  // Fun
  {
    id: 'u1',
    text: 'If a zombie apocalypse happened right now, who would survive longer, and what would be our plan?',
    category: 'Fun',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 'u2',
    text: 'If I suddenly became famous overnight, what would be the reason, and what would change first?',
    category: 'Fun',
    type: 'prediction',
    difficulty: 'Medium',
  },
  {
    id: 'u3',
    text: 'If we could travel back to any historical era for 24 hours, where are we going?',
    category: 'Fun',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 'u4',
    text: 'Which weird habit of mine do you actually find endearing or secretively funny?',
    category: 'Fun',
    type: 'prediction',
    difficulty: 'Medium',
  },
  {
    id: 'u5',
    text: 'If we both got granted one superpower, but they had to combine to be useful, what would they be?',
    category: 'Fun',
    type: 'self',
    difficulty: 'Medium',
  },

  // Emotional
  {
    id: 'e1',
    text: 'When you think about the happiest moment of your life so far, what is happening?',
    category: 'Emotional',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'e2',
    text: 'What is a small, quiet fear you carry that you rarely talk about with anyone else?',
    category: 'Emotional',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'e3',
    text: 'What is the most comforting thing I can say or do when you are having a rough day?',
    category: 'Emotional',
    type: 'prediction',
    difficulty: 'Medium',
  },
  {
    id: 'e4',
    text: 'What gives you the most hope for our future over the next five years?',
    category: 'Emotional',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'e5',
    text: 'What was a moment in our relationship where you felt most emotionally understood?',
    category: 'Emotional',
    type: 'self',
    difficulty: 'Deep',
  },

  // Deep Thinking
  {
    id: 'd1',
    text: 'If time stopped globally today for everyone except us for 24 hours, how would we spend it?',
    category: 'Deep Thinking',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'd2',
    text: 'What is one value or principle that you would never sacrifice, no matter the cost?',
    category: 'Deep Thinking',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'd3',
    text: 'How do you personally define a successful and truly happy life?',
    category: 'Deep Thinking',
    type: 'self',
    difficulty: 'Deep',
  },
  {
    id: 'd4',
    text: 'If you could know the absolute, objective truth to any single question, what would you ask?',
    category: 'Deep Thinking',
    type: 'self',
    difficulty: 'Deep',
  },

  // Future
  {
    id: 't1',
    text: 'Where is our absolute dream destination to travel together in the next three years?',
    category: 'Future',
    type: 'prediction',
    difficulty: 'Medium',
  },
  {
    id: 't2',
    text: 'If we were to co-design our dream house, what is one non-negotiable feature it must have?',
    category: 'Future',
    type: 'self',
    difficulty: 'Medium',
  },
  {
    id: 't3',
    text: 'What is a major bucket-list item we absolutely must cross off together?',
    category: 'Future',
    type: 'self',
    difficulty: 'Easy',
  },
  {
    id: 't4',
    text: 'Where do you see us in ten years, and how has our friendship evolved?',
    category: 'Future',
    type: 'self',
    difficulty: 'Deep',
  }
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_streak_7',
    title: '7 Day Streak',
    description: 'Log in and answer questions for 7 days in a row.',
    icon: '🔥',
    earned: false,
  },
  {
    id: 'ach_streak_30',
    title: '30 Day Streak',
    description: 'Log in and answer questions for 30 days in a row.',
    icon: '👑',
    earned: false,
  },
  {
    id: 'ach_q_100',
    title: 'Centurion of Bond',
    description: 'Complete 100 questions together.',
    icon: '🏆',
    earned: false,
  },
  {
    id: 'ach_perfect_pred',
    title: 'Perfect Prediction',
    description: 'Get an accuracy score of 95% or higher on a prediction challenge.',
    icon: '👁️',
    earned: false,
  },
  {
    id: 'ach_mind_reader',
    title: 'Mind Reader',
    description: 'Get three perfect predictions in a single week.',
    icon: '🧠',
    earned: false,
  },
  {
    id: 'ach_soul_sync',
    title: 'Soul Sync',
    description: 'Reach a daily bond score of 95% or higher.',
    icon: '💖',
    earned: false,
  },
  {
    id: 'ach_memory_master',
    title: 'Memory Master',
    description: 'Correctly recall a partner\'s answer from over a month ago in the Memory Challenge.',
    icon: '💾',
    earned: false,
  }
];

export const INITIAL_TIMELINE_EVENTS: FriendshipTimelineEvent[] = [
  {
    id: 'evt_1',
    title: 'Bondly Journey Began',
    description: 'Connected your accounts and created your Bond.',
    date: new Date().toISOString().split('T')[0],
    type: 'milestone',
    icon: '🤝',
  }
];
