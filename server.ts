import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { supabase } from './src/lib/supabaseClient';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
let isKeyMissing = false;

function getGeminiClient() {
  if (aiClient) return aiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    console.warn('GEMINI_API_KEY is not configured or is a placeholder. Using fallback mock AI mode.');
    isKeyMissing = true;
    return null;
  }

  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    isKeyMissing = false;
    return aiClient;
  } catch (error) {
    console.error('Failed to initialize GoogleGenAI client:', error);
    isKeyMissing = true;
    return null;
  }
}

// -------------------------------------------------------------
// Real-time Multi-Device Room Store & Non-Repeating Question Engine
// -------------------------------------------------------------

interface RoomQuestion {
  id: string;
  questionId: string;
  text: string;
  category: string;
  type: string;
  difficulty: string;
  unlockTime: string;
  options?: string[];
  user1Answer?: string;
  user1Explanation?: string;
  user1Prediction?: string;
  user2Answer?: string;
  user2Explanation?: string;
  user2Prediction?: string;
  similarityScore?: number;
  aiCommentary?: string;
}

interface ServerRoom {
  roomCode: string;
  user1: any | null;
  user2: any | null;
  currentDate: string;
  usedQuestionIds: string[];
  dailySession: {
    id: string;
    date: string;
    questions: RoomQuestion[];
    compatibilityScore?: number;
    aiSummary?: string;
    completedAt?: string;
    breakdown?: any;
  };
  memories: any[];
  timeline: any[];
  lastUpdated: number;
}

const rooms: Map<string, ServerRoom> = new Map();

// Helper to save room to Supabase DB
async function persistRoom(room: ServerRoom) {
  rooms.set(room.roomCode, room);
  if (supabase) {
    try {
      await supabase.from('rooms').upsert({
        room_code: room.roomCode,
        data: room,
        last_updated: new Date().toISOString()
      }, { onConflict: 'room_code' });
    } catch (e) {
      console.warn('Supabase DB upsert warning:', e);
    }
  }
}

// Helper to fetch room from memory or Supabase DB
async function fetchRoom(roomCode: string): Promise<ServerRoom | null> {
  const cleanCode = roomCode.trim().toUpperCase();
  if (rooms.has(cleanCode)) return rooms.get(cleanCode)!;
  if (supabase) {
    try {
      const { data } = await supabase.from('rooms').select('data').eq('room_code', cleanCode).single();
      if (data && data.data) {
        rooms.set(cleanCode, data.data as ServerRoom);
        return data.data as ServerRoom;
      }
    } catch (e) {
      // Not found in DB
    }
  }
  return null;
}

// Extended Pool of Unique Daily Questions across 6 Categories
const QUESTION_POOL = [
  // Friendship
  { id: 'f1', text: 'What was your first impression of me when we first met, and how has it changed?', category: 'Friendship', type: 'self', difficulty: 'Easy' },
  { id: 'f2', text: 'What is my greatest strength that I often underestimate in myself?', category: 'Friendship', type: 'prediction', difficulty: 'Medium' },
  { id: 'f3', text: 'If we could start a business together tomorrow, what would we sell?', category: 'Friendship', type: 'self', difficulty: 'Easy' },
  { id: 'f4', text: 'What is our funniest shared memory that never fails to make you laugh?', category: 'Friendship', type: 'self', difficulty: 'Easy' },
  { id: 'f5', text: 'When was a moment you felt incredibly proud of our relationship?', category: 'Friendship', type: 'self', difficulty: 'Medium' },

  // Fun
  { id: 'u1', text: 'If a zombie apocalypse happened right now, who would survive longer, and what would be our plan?', category: 'Fun', type: 'self', difficulty: 'Easy' },
  { id: 'u2', text: 'If I suddenly became famous overnight, what would be the reason, and what would change first?', category: 'Fun', type: 'prediction', difficulty: 'Medium' },
  { id: 'u3', text: 'If we could travel back to any historical era for 24 hours, where are we going?', category: 'Fun', type: 'self', difficulty: 'Easy' },
  { id: 'u4', text: 'Which weird habit of mine do you actually find endearing or secretively funny?', category: 'Fun', type: 'prediction', difficulty: 'Medium' },
  { id: 'u5', text: 'If we both got granted one superpower, but they had to combine to be useful, what would they be?', category: 'Fun', type: 'self', difficulty: 'Medium' },

  // Emotional
  { id: 'e1', text: 'When you think about the happiest moment of your life so far, what is happening?', category: 'Emotional', type: 'self', difficulty: 'Deep' },
  { id: 'e2', text: 'What is a small, quiet fear you carry that you rarely talk about with anyone else?', category: 'Emotional', type: 'self', difficulty: 'Deep' },
  { id: 'e3', text: 'What is the most comforting thing I can say or do when you are having a rough day?', category: 'Emotional', type: 'prediction', difficulty: 'Medium' },
  { id: 'e4', text: 'What gives you the most hope for our future over the next five years?', category: 'Emotional', type: 'self', difficulty: 'Deep' },
  { id: 'e5', text: 'What was a moment in our relationship where you felt most emotionally understood?', category: 'Emotional', type: 'self', difficulty: 'Deep' },

  // Deep Thinking
  { id: 'd1', text: 'If time stopped globally today for everyone except us for 24 hours, how would we spend it?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' },
  { id: 'd2', text: 'What is one value or principle that you would never sacrifice, no matter the cost?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' },
  { id: 'd3', text: 'How do you personally define a successful and truly happy life?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' },
  { id: 'd4', text: 'If you could know the absolute, objective truth to any single question, what would you ask?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' },

  // Future
  { id: 't1', text: 'Where is our absolute dream destination to travel together in the next three years?', category: 'Future', type: 'prediction', difficulty: 'Medium' },
  { id: 't2', text: 'If we were to co-design our dream house, what is one non-negotiable feature it must have?', category: 'Future', type: 'self', difficulty: 'Medium' },
  { id: 't3', text: 'What is a major bucket-list item we absolutely must cross off together?', category: 'Future', type: 'self', difficulty: 'Easy' },
  { id: 't4', text: 'Where do you see us in ten years, and how has our friendship evolved?', category: 'Future', type: 'self', difficulty: 'Deep' },

  // Multiple Choice Option Match Challenges
  { 
    id: 'm1', 
    text: 'Where would we go on our ultimate surprise weekend getaway?', 
    category: 'Fun', 
    type: 'multiple_choice', 
    difficulty: 'Easy',
    options: ['Cozy Mountain Cabin 🏔️', 'Sunny Beach Resort 🏖️', 'Bustling City Hotel 🏙️', 'Peaceful Forest Camping 🌲']
  },
  { 
    id: 'm2', 
    text: 'What is our absolute ideal Friday night activity together?', 
    category: 'Friendship', 
    type: 'multiple_choice', 
    difficulty: 'Easy',
    options: ['Bingeing a show with snacks 🍿', 'Cooking a fancy dinner 🍝', 'Late night drive & deep chats 🚗', 'Board games or gaming 🎮']
  },
  { 
    id: 'm3', 
    text: 'If we suddenly won $10,000 today, what would we do first?', 
    category: 'Future', 
    type: 'multiple_choice', 
    difficulty: 'Medium',
    options: ['Book a luxury trip abroad ✈️', 'Invest & save for the future 📈', 'Go on a massive shopping spree 🛍️', 'Upgrade our living space 🏡']
  },
  { 
    id: 'm4', 
    text: 'Which superhero duo role best describes us in a crisis?', 
    category: 'Fun', 
    type: 'multiple_choice', 
    difficulty: 'Easy',
    options: ['The Master Strategist 🧠', 'The Hype Action Leader ⚡', 'The Calm Caretaker 🛡️', 'The Funny Specialist 🎭']
  }
];

// Calculate Scheduled Unlock Times (8 AM, 12 PM, 4 PM, 8 PM, 11 PM)
function getScheduledUnlockTime(index: number, baseDate?: Date): string {
  const target = baseDate ? new Date(baseDate) : new Date();
  const hours = [8, 12, 16, 20, 23]; // Morning, Afternoon, Evening, Night, Late Night
  const selectedHour = hours[index] !== undefined ? hours[index] : 8 + index * 3;
  target.setHours(selectedHour, 0, 0, 0);
  return target.toISOString();
}

// Select 5 unique, non-repeating questions
function getNonRepeatingQuestions(usedSet: Set<string>, count = 5): any[] {
  let available = QUESTION_POOL.filter(q => !usedSet.has(q.id));
  if (available.length < count) {
    usedSet.clear();
    available = [...QUESTION_POOL];
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  selected.forEach(q => usedSet.add(q.id));
  return selected;
}

function formatRoomForSlot(room: ServerRoom, slot: 'user1' | 'user2') {
  const isUser1 = slot === 'user1';
  const myProfile = isUser1 ? room.user1 : room.user2;
  const partnerProfile = isUser1 ? room.user2 : room.user1;

  const formattedQuestions = room.dailySession.questions.map(q => {
    const myAns = isUser1 ? q.user1Answer : q.user2Answer;
    const partnerAns = isUser1 ? q.user2Answer : q.user1Answer;
    const myExp = isUser1 ? q.user1Explanation : q.user2Explanation;
    const partnerExp = isUser1 ? q.user2Explanation : q.user1Explanation;
    const myPred = isUser1 ? q.user1Prediction : q.user2Prediction;
    const partnerPred = isUser1 ? q.user2Prediction : q.user1Prediction;

    const answeredByUser = q.type === 'prediction' ? !!myPred : !!myAns;
    const answeredByPartner = q.type === 'prediction' ? !!partnerPred : !!partnerAns;

    return {
      id: q.id,
      questionId: q.questionId,
      text: q.text,
      category: q.category,
      type: q.type,
      difficulty: q.difficulty,
      options: q.options,
      unlockTime: q.unlockTime,
      answeredByUser,
      answeredByPartner,
      userAnswer: myAns || '',
      partnerAnswer: partnerAns || '',
      userExplanation: myExp,
      partnerExplanation: partnerExp,
      userPrediction: myPred,
      partnerPrediction: partnerPred,
      similarityScore: q.similarityScore,
      aiCommentary: q.aiCommentary,
    };
  });

  return {
    roomCode: room.roomCode,
    profile: myProfile,
    partnerProfile: partnerProfile,
    dailySession: {
      ...room.dailySession,
      questions: formattedQuestions
    },
    memories: room.memories,
    timeline: room.timeline,
    lastUpdated: room.lastUpdated
  };
}

// Internal evaluation helper using Gemini AI or Mock logic
async function evaluateAnswersInternal(
  questionText: string,
  category: string,
  type: string,
  userAnswer: string,
  partnerAnswer: string,
  userPrediction?: string,
  partnerPrediction?: string
): Promise<{ similarityScore: number; aiCommentary: string }> {
  const client = getGeminiClient();

  if (isKeyMissing || !client) {
    let score = 88;
    let commentary = `You both shared deep and meaningful perspectives in the ${category} category!`;

    if (type === 'multiple_choice') {
      const isMatch = (userAnswer || '').trim() === (partnerAnswer || '').trim();
      return {
        similarityScore: isMatch ? 100 : 60,
        aiCommentary: isMatch
          ? `Perfect Choice Match! You both chose "${userAnswer}". Total alignment!`
          : `Choice Match: You selected "${userAnswer}" while your partner chose "${partnerAnswer}". Unique preferences make your bond interesting!`
      };
    }

    if (type === 'prediction') {
      const pAns = (userPrediction || '').toLowerCase().trim();
      const actAns = (partnerAnswer || '').toLowerCase().trim();
      if (pAns && actAns && (pAns === actAns || pAns.includes(actAns) || actAns.includes(pAns))) {
        score = 96;
        commentary = `Incredible prediction! You perfectly understood what your partner would say. This level of synchronization shows a beautiful connection.`;
      } else {
        score = 74;
        commentary = `A playful miss! While the prediction didn't align perfectly, the difference highlights a surprising, delightful aspect of their personality.`;
      }
    } else {
      score = 90;
      commentary = `You both approached this from warm, genuine angles. Your hearts are in the exact same place!`;
    }
    return { similarityScore: score, aiCommentary: commentary };
  }

  try {
    const prompt = `
      We are playing a friendship/relationship bonding game called Bondly.
      Evaluate the similarity and connection between these two answers:
      
      Question Text: "${questionText}"
      Category: "${category}"
      Challenge Type: "${type}" (self means they answered for themselves, prediction means User predicted Partner's answer)
      
      ${type === 'prediction' ? `User's Prediction of Partner: "${userPrediction}"\nPartner's Actual Answer: "${partnerAnswer}"` : `User 1 Answer: "${userAnswer}"\nUser 2 Answer: "${partnerAnswer}"`}
      
      Calculate a similarity/accuracy percentage (an integer between 0 and 100).
      Write a warm, cozy, and highly personalized AI commentary (exactly 1-2 sentences) commenting on their answers.
      Tone: emotional, supportive, delight-driven. Use "you" and "your partner".
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            similarityScore: { type: Type.INTEGER },
            aiCommentary: { type: Type.STRING },
          },
          required: ['similarityScore', 'aiCommentary'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Gemini evaluate internal error:', error);
    return { similarityScore: 85, aiCommentary: 'You both shared wonderful thoughts that reflect your special connection.' };
  }
}

// Internal session summary helper
async function generateSessionSummaryInternal(questions: RoomQuestion[]): Promise<{
  compatibilityScore: number;
  breakdown: { communication: number; dreams: number; humor: number; emotions: number; lifestyle: number };
  aiSummary: string;
}> {
  const client = getGeminiClient();

  if (isKeyMissing || !client) {
    const avgScore = Math.round(questions.reduce((sum, q) => sum + (q.similarityScore || 85), 0) / questions.length) || 88;
    return {
      compatibilityScore: avgScore,
      breakdown: {
        communication: Math.min(100, Math.round(avgScore * 1.05)),
        dreams: Math.min(100, Math.round(avgScore * 0.98)),
        humor: Math.min(100, Math.round(avgScore * 0.92)),
        emotions: Math.min(100, Math.round(avgScore * 1.02)),
        lifestyle: Math.min(100, Math.round(avgScore * 0.95))
      },
      aiSummary: `Today's interactions revealed a rich emotional dialogue between you two. You are building a gorgeous timeline together!`
    };
  }

  try {
    const qDetails = questions.map((q, idx) => {
      return `Question ${idx+1}: "${q.text}" (${q.category})\nUser 1 Answer/Prediction: "${q.user1Answer || q.user1Prediction}"\nUser 2 Answer/Prediction: "${q.user2Answer || q.user2Prediction}"\nSimilarity Score: ${q.similarityScore}%`;
    }).join('\n\n');

    const prompt = `
      You are Bondly's relationship coordinator AI. Review today's completed daily session of questions and answers between two partners:
      
      ${qDetails}
      
      Tasks:
      1. Determine Today's Bond Score (overall average percentage 0-100).
      2. Provide a category breakdown for these five dimensions (each 0-100):
         - Communication
         - Dreams
         - Humor
         - Emotions
         - Lifestyle
      3. Write a comforting, emotional, and encouraging AI summary of their bond today (exactly 2 sentences).
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            compatibilityScore: { type: Type.INTEGER },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                communication: { type: Type.INTEGER },
                dreams: { type: Type.INTEGER },
                humor: { type: Type.INTEGER },
                emotions: { type: Type.INTEGER },
                lifestyle: { type: Type.INTEGER },
              },
              required: ['communication', 'dreams', 'humor', 'emotions', 'lifestyle']
            },
            aiSummary: { type: Type.STRING },
          },
          required: ['compatibilityScore', 'breakdown', 'aiSummary'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Gemini summary internal error:', error);
    return {
      compatibilityScore: 88,
      breakdown: { communication: 90, dreams: 85, humor: 88, emotions: 92, lifestyle: 86 },
      aiSummary: 'You both showed wonderful mutual understanding and shared values today.'
    };
  }
}

// -------------------------------------------------------------
// ROOM PAIRING API ENDPOINTS
// -------------------------------------------------------------

// API: Create a new room with 5 unique non-repeating questions
app.post('/api/rooms/create', async (req, res) => {
  const { profile } = req.body;
  const code = 'BOND-' + Math.floor(1000 + Math.random() * 9000);
  const todayStr = new Date().toISOString().split('T')[0];

  const usedSet = new Set<string>();
  const picked = getNonRepeatingQuestions(usedSet, 5);

  const roomQuestions: RoomQuestion[] = picked.map((q, idx) => ({
    id: `dq_${q.id}_${Date.now()}`,
    questionId: q.id,
    text: q.text,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty,
    options: q.options,
    unlockTime: getScheduledUnlockTime(idx),
  }));

  const updatedProfile = {
    ...profile,
    roomCode: code,
    slot: 'user1',
    connected: false
  };

  const room: ServerRoom = {
    roomCode: code,
    user1: updatedProfile,
    user2: null,
    currentDate: todayStr,
    usedQuestionIds: Array.from(usedSet),
    dailySession: {
      id: `sess_${todayStr}`,
      date: todayStr,
      questions: roomQuestions
    },
    memories: [],
    timeline: [],
    lastUpdated: Date.now()
  };

  await persistRoom(room);
  return res.json({ roomCode: code, profile: updatedProfile, roomState: formatRoomForSlot(room, 'user1') });
});

// API: Join an existing room via Pair Code
app.post('/api/rooms/join', async (req, res) => {
  const { roomCode, profile } = req.body;
  const cleanCode = (roomCode || '').trim().toUpperCase();
  const room = await fetchRoom(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found. Check your Pair Code and try again.' });
  }

  const user2Profile = {
    ...profile,
    roomCode: cleanCode,
    slot: 'user2',
    partnerCode: room.user1 ? room.user1.friendCode : 'BOND-HOST',
    partnerName: room.user1 ? room.user1.name : 'Bestie',
    partnerAvatarUrl: room.user1 ? room.user1.avatarUrl : '🐹',
    connected: true
  };

  if (room.user1) {
    room.user1.partnerName = user2Profile.name;
    room.user1.partnerAvatarUrl = user2Profile.avatarUrl;
    room.user1.connected = true;
  }
  room.user2 = user2Profile;
  room.lastUpdated = Date.now();

  await persistRoom(room);
  return res.json({ profile: user2Profile, roomState: formatRoomForSlot(room, 'user2') });
});

// API: Get latest Room State
app.get('/api/rooms/:roomCode', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.query.slot as string) === 'user2' ? 'user2' : 'user1';
  const room = await fetchRoom(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Submit Answer in Room (with backend scheduled unlock time check)
app.post('/api/rooms/:roomCode/answer', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const { slot, questionIndex, answer, explanation, prediction } = req.body;
  const room = await fetchRoom(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const q = room.dailySession.questions[questionIndex];
  if (!q) {
    return res.status(400).json({ error: 'Invalid question index' });
  }

  // Backend verification of scheduled unlock time
  const unlockDate = new Date(q.unlockTime);
  const now = new Date();
  if (unlockDate > now) {
    const formatted = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return res.status(403).json({ error: `This prompt is locked until ${formatted}!` });
  }

  if (slot === 'user1') {
    if (q.type === 'prediction') {
      q.user1Prediction = prediction;
    } else {
      q.user1Answer = answer;
      q.user1Explanation = explanation;
    }
  } else {
    if (q.type === 'prediction') {
      q.user2Prediction = prediction;
    } else {
      q.user2Answer = answer;
      q.user2Explanation = explanation;
    }
  }

  const user1Responded = q.type === 'prediction' ? !!q.user1Prediction : !!q.user1Answer;
  const user2Responded = q.type === 'prediction' ? !!q.user2Prediction : !!q.user2Answer;

  // Trigger AI analysis when BOTH users have responded
  if (user1Responded && user2Responded && !q.similarityScore) {
    const aiResult = await evaluateAnswersInternal(
      q.text,
      q.category,
      q.type,
      q.user1Answer || '',
      q.user2Answer || '',
      q.user1Prediction || '',
      q.user2Prediction || ''
    );

    q.similarityScore = aiResult.similarityScore;
    q.aiCommentary = aiResult.aiCommentary;

    // Push to shared memories
    room.memories.unshift({
      id: `mem_${Date.now()}_${questionIndex}`,
      date: room.dailySession.date,
      questionText: q.text,
      category: q.category,
      userAnswer: q.user1Answer || q.user1Prediction || '',
      partnerAnswer: q.user2Answer || q.user2Prediction || '',
      similarityScore: aiResult.similarityScore,
      aiCommentary: aiResult.aiCommentary,
    });
  }

  room.lastUpdated = Date.now();
  await persistRoom(room);
  return res.json({ roomState: formatRoomForSlot(room, slot || 'user1') });
});

// API: Generate 5 new non-repeating questions for a new day
app.post('/api/rooms/:roomCode/new-day', (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.body.slot as 'user1' | 'user2') || 'user1';
  const room = rooms.get(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const usedSet = new Set<string>(room.usedQuestionIds || []);
  const picked = getNonRepeatingQuestions(usedSet, 5);
  const todayStr = new Date().toISOString().split('T')[0];

  const roomQuestions: RoomQuestion[] = picked.map((q, idx) => ({
    id: `dq_${q.id}_${Date.now()}`,
    questionId: q.id,
    text: q.text,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty,
    unlockTime: getScheduledUnlockTime(idx),
  }));

  room.usedQuestionIds = Array.from(usedSet);
  room.currentDate = todayStr;
  room.dailySession = {
    id: `sess_${todayStr}_${Date.now()}`,
    date: todayStr,
    questions: roomQuestions
  };
  room.lastUpdated = Date.now();

  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Clear all answers in a room
app.post('/api/rooms/:roomCode/clear', (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.body.slot as 'user1' | 'user2') || 'user1';
  const room = rooms.get(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.dailySession.questions.forEach(q => {
    delete q.user1Answer;
    delete q.user1Explanation;
    delete q.user1Prediction;
    delete q.user2Answer;
    delete q.user2Explanation;
    delete q.user2Prediction;
    delete q.similarityScore;
    delete q.aiCommentary;
  });

  delete room.dailySession.compatibilityScore;
  delete room.dailySession.breakdown;
  delete room.dailySession.aiSummary;
  room.memories = [];
  room.lastUpdated = Date.now();

  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Complete Room Daily Session Summary
app.post('/api/rooms/:roomCode/summary', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.body.slot as 'user1' | 'user2') || 'user1';
  const room = rooms.get(cleanCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (!room.dailySession.compatibilityScore) {
    const summaryData = await generateSessionSummaryInternal(room.dailySession.questions);
    room.dailySession.compatibilityScore = summaryData.compatibilityScore;
    room.dailySession.breakdown = summaryData.breakdown;
    room.dailySession.aiSummary = summaryData.aiSummary;
    room.dailySession.completedAt = new Date().toISOString();
  }

  room.lastUpdated = Date.now();
  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// -------------------------------------------------------------
// Standard AI API Endpoints
// -------------------------------------------------------------

app.get('/api/ai/status', (req, res) => {
  getGeminiClient();
  res.json({ mockMode: isKeyMissing });
});

app.post('/api/ai/reveal', async (req, res) => {
  const { questionText, category, type, userAnswer, partnerAnswer, userPrediction, partnerPrediction } = req.body;
  const data = await evaluateAnswersInternal(questionText, category, type, userAnswer, partnerAnswer, userPrediction, partnerPrediction);
  return res.json(data);
});

app.post('/api/ai/session-summary', async (req, res) => {
  const { questions } = req.body;
  const data = await generateSessionSummaryInternal(questions);
  return res.json(data);
});

app.post('/api/ai/monthly-story', async (req, res) => {
  const { memories } = req.body;
  const client = getGeminiClient();

  if (isKeyMissing || !client || !memories || memories.length === 0) {
    const mockStory = `This month, your bond became noticeably stronger and beautifully anchored. You learned more about each other's hidden fears than ever before, and you became incredibly skilled at predicting each other's thoughts. Every answered question added a bright chapter to your shared timeline!`;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return res.json({ story: mockStory });
  }

  try {
    const memoryDetails = memories.map((m: any, idx: number) => {
      return `Day ${idx+1} (${m.date}) - Question: "${m.questionText}"\nUser: "${m.userAnswer}" | Partner: "${m.partnerAnswer}"\nAI commentary: "${m.aiCommentary}"`;
    }).join('\n\n');

    const prompt = `
      Review these memories shared by two best friends over the past few weeks:
      ${memoryDetails}
      Write a heartwarming, emotional, and deeply personalized Monthly Friendship Story (3-4 sentences). Format like a beautiful journal entry.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { story: { type: Type.STRING } },
          required: ['story']
        }
      }
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('Gemini monthly story error:', error);
    res.status(500).json({ error: 'Failed to generate monthly story' });
  }
});

app.post('/api/ai/custom-questions', async (req, res) => {
  const { pastQuestions } = req.body;
  const client = getGeminiClient();

  if (isKeyMissing || !client) {
    const mockQuestions = [
      { id: 'dyn_1', text: 'What is a song that instantly reminds you of me, and what memory is tied to it?', category: 'Emotional', type: 'self', difficulty: 'Medium' },
      { id: 'dyn_2', text: 'If we were forced to live in a fantasy world, what roles would we take in our adventuring party?', category: 'Fun', type: 'self', difficulty: 'Easy' },
      { id: 'dyn_3', text: 'What is my absolute favorite comfort food when I am feeling down or stressed?', category: 'Future', type: 'prediction', difficulty: 'Medium' },
      { id: 'dyn_4', text: 'If our friendship was a movie, what would the title be and who would play us?', category: 'Friendship', type: 'self', difficulty: 'Medium' },
      { id: 'dyn_5', text: 'What is a quiet dream you have for us that you have never spoken aloud?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' }
    ];
    await new Promise((resolve) => setTimeout(resolve, 600));
    return res.json({ questions: mockQuestions });
  }

  try {
    const pastDetails = pastQuestions ? pastQuestions.join(', ') : 'None';
    const prompt = `
      You are Bondly's question-generation engine. Past questions: ${pastDetails}.
      Generate 5 unique and engaging daily questions. Include categories: Friendship, Fun, Emotional, Deep Thinking, Future.
      Include at least one prediction question.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['Friendship', 'Fun', 'Emotional', 'Deep Thinking', 'Future', 'Random'] },
                  type: { type: Type.STRING, enum: ['self', 'prediction', 'rapid_fire'] },
                  difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Deep'] }
                },
                required: ['id', 'text', 'category', 'type', 'difficulty']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('Gemini custom questions error:', error);
    res.status(500).json({ error: 'Failed to generate custom questions' });
  }
});

// -------------------------------------------------------------
// Vite and Static File Middleware
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bondly express backend running on http://localhost:${PORT}`);
  });
}

startServer();
