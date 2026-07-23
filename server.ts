import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { supabase } from './src/lib/supabaseClient';

dotenv.config();

const app = express();

// Enable CORS for mobile apps and cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialization of Groq API status
let isGroqKeyMissing = false;

// Groq API Helper Function using native fetch
async function callGroqAPI(prompt: string, responseSchemaDesc?: string): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '') {
    isGroqKeyMissing = true;
    throw new Error('Groq API Key is missing or not configured');
  }

  isGroqKeyMissing = false;

  const systemMessage = responseSchemaDesc
    ? `You are a helpful AI assistant. You must output a valid JSON object matching this schema or structure: ${responseSchemaDesc}. Do not output any conversational text or formatting outside the JSON object.`
    : `You are a helpful AI assistant.`;

  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ]
  };

  if (responseSchemaDesc) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API returned ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty response');
  }

  if (responseSchemaDesc) {
    return JSON.parse(content);
  }
  return content;
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
  room.lastUpdated = Date.now();
  rooms.set(room.roomCode, room);
  if (supabase) {
    try {
      const { error } = await supabase.from('rooms').upsert({
        room_code: room.roomCode,
        data: room,
        last_updated: new Date().toISOString()
      }, { onConflict: 'room_code' });
      
      if (error) {
        console.error('❌ Supabase DB upsert error:', error.message, error.details);
      } else {
        console.log(`✅ Room ${room.roomCode} successfully persisted to Supabase.`);
      }
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
      const { data, error } = await supabase.from('rooms').select('data').eq('room_code', cleanCode).single();
      if (error && error.code !== 'PGRST116') {
        console.warn('⚠️ Supabase DB select error:', error.message);
      }
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

// Calculate Scheduled Unlock Times (8 AM, 12 PM, 4 PM, 8 PM, 10 PM)
function getScheduledUnlockTime(index: number, baseDate?: Date): string {
  const bypassLock = process.env.BYPASS_TIME_LOCK === 'true';
  if (bypassLock) {
    const d = new Date(Date.now() - 60000); // 1 minute ago
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hourStr = String(d.getHours()).padStart(2, '0');
    const minStr = String(d.getMinutes()).padStart(2, '0');
    const secStr = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hourStr}:${minStr}:${secStr}`;
  }

  const d = baseDate ? new Date(baseDate) : new Date();
  const hours = [8, 12, 16, 20, 22]; // Morning (8 AM), Afternoon (12 PM), Evening (4 PM), Night (8 PM), Late Night (10 PM)
  const selectedHour = hours[index] !== undefined ? hours[index] : 8 + index * 3;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hourStr = String(selectedHour).padStart(2, '0');

  return `${year}-${month}-${day}T${hourStr}:00:00`;
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

// Internal evaluation helper using Groq AI or Mock logic
async function evaluateAnswersInternal(
  questionText: string,
  category: string,
  type: string,
  userAnswer: string,
  partnerAnswer: string,
  userPrediction?: string,
  partnerPrediction?: string
): Promise<{ similarityScore: number; aiCommentary: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  if (isKeyMissing) {
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

    const schemaDesc = `{ similarityScore: number (0-100), aiCommentary: string }`;
    const data = await callGroqAPI(prompt, schemaDesc);
    return {
      similarityScore: Number(data.similarityScore) || 85,
      aiCommentary: data.aiCommentary || 'You both shared wonderful thoughts that reflect your special connection.'
    };
  } catch (error) {
    console.error('Groq evaluate internal error:', error);
    return { similarityScore: 85, aiCommentary: 'You both shared wonderful thoughts that reflect your special connection.' };
  }
}

// Internal session summary helper using Groq
async function generateSessionSummaryInternal(questions: RoomQuestion[]): Promise<{
  compatibilityScore: number;
  breakdown: { communication: number; dreams: number; humor: number; emotions: number; lifestyle: number };
  aiSummary: string;
}> {
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  if (isKeyMissing) {
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
      return `Question ${idx + 1}: "${q.text}" (${q.category})\nUser 1 Answer/Prediction: "${q.user1Answer || q.user1Prediction}"\nUser 2 Answer/Prediction: "${q.user2Answer || q.user2Prediction}"\nSimilarity Score: ${q.similarityScore}%`;
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

    const schemaDesc = `{ compatibilityScore: number (0-100), breakdown: { communication: number (0-100), dreams: number (0-100), humor: number (0-100), emotions: number (0-100), lifestyle: number (0-100) }, aiSummary: string }`;
    const data = await callGroqAPI(prompt, schemaDesc);

    return {
      compatibilityScore: Number(data.compatibilityScore) || 88,
      breakdown: {
        communication: Number(data.breakdown?.communication) || 85,
        dreams: Number(data.breakdown?.dreams) || 85,
        humor: Number(data.breakdown?.humor) || 85,
        emotions: Number(data.breakdown?.emotions) || 85,
        lifestyle: Number(data.breakdown?.lifestyle) || 85
      },
      aiSummary: data.aiSummary || 'You both showed wonderful mutual understanding and shared values today.'
    };
  } catch (error) {
    console.error('Groq summary internal error:', error);
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

  // Automatic Midnight Rollover: Check if date has changed
  const todayStr = new Date().toISOString().split('T')[0];
  let roomUpdated = false;

  if (room.currentDate !== todayStr) {
    // Backup old daily session questions to memories before resetting dailySession
    if (room.dailySession && room.dailySession.questions) {
      for (const q of room.dailySession.questions) {
        const user1Responded = q.type === 'prediction' ? !!q.user1Prediction : !!q.user1Answer;
        const user2Responded = q.type === 'prediction' ? !!q.user2Prediction : !!q.user2Answer;

        if (user1Responded || user2Responded) {
          const alreadyArchived = room.memories.some(
            m => m.questionText === q.text && m.date === room.dailySession.date
          );
          if (!alreadyArchived) {
            let similarityScore = q.similarityScore;
            let aiCommentary = q.aiCommentary;
            if (!similarityScore) {
              try {
                const aiResult = await evaluateAnswersInternal(
                  q.text,
                  q.category,
                  q.type,
                  q.user1Answer || '',
                  q.user2Answer || '',
                  q.user1Prediction || '',
                  q.user2Prediction || ''
                );
                similarityScore = aiResult.similarityScore;
                aiCommentary = aiResult.aiCommentary;
              } catch (e) {
                similarityScore = 85;
                aiCommentary = 'Shared wonderful thoughts reflecting your connection.';
              }
            }

            room.memories.unshift({
              id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              date: room.dailySession.date,
              questionText: q.text,
              category: q.category,
              userAnswer: q.user1Answer || q.user1Prediction || '',
              partnerAnswer: q.user2Answer || q.user2Prediction || '',
              similarityScore,
              aiCommentary,
            });
          }
        }
      }
    }

    const usedSet = new Set<string>(room.usedQuestionIds || []);
    const picked = getNonRepeatingQuestions(usedSet, 5);
    const todayDate = new Date();

    const roomQuestions: RoomQuestion[] = picked.map((q, idx) => ({
      id: `dq_${q.id}_${Date.now()}`,
      questionId: q.id,
      text: q.text,
      category: q.category,
      type: q.type,
      difficulty: q.difficulty,
      options: q.options,
      unlockTime: getScheduledUnlockTime(idx, todayDate),
    }));

    room.currentDate = todayStr;
    room.usedQuestionIds = Array.from(usedSet);
    room.dailySession = {
      id: `sess_${todayStr}`,
      date: todayStr,
      questions: roomQuestions
    };
    roomUpdated = true;
  }

  // Auto-delete expired memories (older than 2 days)
  if (room.memories && room.memories.length > 0) {
    const todayDateObj = new Date(todayStr);
    const originalLength = room.memories.length;
    room.memories = room.memories.filter(mem => {
      const memDateObj = new Date(mem.date);
      if (isNaN(memDateObj.getTime())) return true;
      const diffTime = todayDateObj.getTime() - memDateObj.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 2; // Keep if <= 2 days old (removes after the day after tomorrow)
    });
    if (room.memories.length !== originalLength) {
      roomUpdated = true;
    }
  }

  if (roomUpdated) {
    room.lastUpdated = Date.now();
    await persistRoom(room);
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

  // Backend verification of scheduled unlock time (Disabled to prevent timezone mismatch issues)
  /*
  const unlockDate = new Date(q.unlockTime);
  const now = new Date();
  if (unlockDate > now) {
    const formatted = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return res.status(403).json({ error: `This prompt is locked until ${formatted}!` });
  }
  */

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



    // Check if all 5 questions are complete
    const allCompleted = room.dailySession.questions.every(dq => {
      const u1Done = dq.type === 'prediction' ? !!dq.user1Prediction : !!dq.user1Answer;
      const u2Done = dq.type === 'prediction' ? !!dq.user2Prediction : !!dq.user2Answer;
      return u1Done && u2Done;
    });

    if (allCompleted && !room.dailySession.compatibilityScore) {
      try {
        const summaryData = await generateSessionSummaryInternal(room.dailySession.questions);
        room.dailySession.compatibilityScore = summaryData.compatibilityScore;
        room.dailySession.breakdown = summaryData.breakdown;
        room.dailySession.aiSummary = summaryData.aiSummary;
        room.dailySession.completedAt = new Date().toISOString();

        // Increment streaks for both users
        if (room.user1) {
          room.user1.streakCount = (room.user1.streakCount || 0) + 1;
        }
        if (room.user2) {
          room.user2.streakCount = (room.user2.streakCount || 0) + 1;
        }

        // Push milestone event to timeline
        const completedDate = new Date().toISOString().split('T')[0];
        room.timeline.unshift({
          id: `evt_completed_${Date.now()}`,
          title: 'Daily Prompts Completed! 🎉',
          description: `Completed all 5 daily prompts with a bond score of ${summaryData.compatibilityScore}%!`,
          date: completedDate,
          type: 'milestone',
          icon: '💖'
        });
      } catch (e) {
        console.error('Failed to generate summary in answer handler:', e);
      }
    }
  }

  room.lastUpdated = Date.now();
  await persistRoom(room);
  return res.json({ roomState: formatRoomForSlot(room, slot || 'user1') });
});

// API: Generate 5 new non-repeating questions for a new day (Disabled)
app.post('/api/rooms/:roomCode/new-day', async (req, res) => {
  return res.status(400).json({ error: 'Manual prompt generation is disabled.' });
});

// API: Clear all answers in a room
app.post('/api/rooms/:roomCode/clear', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.body.slot as 'user1' | 'user2') || 'user1';
  const room = await fetchRoom(cleanCode);

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

  await persistRoom(room);

  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Complete Room Daily Session Summary
app.post('/api/rooms/:roomCode/summary', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = (req.body.slot as 'user1' | 'user2') || 'user1';
  const room = await fetchRoom(cleanCode);

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
  await persistRoom(room);

  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// -------------------------------------------------------------
// Standard AI API Endpoints
// -------------------------------------------------------------

app.get('/api/ai/status', (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';
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
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  if (isKeyMissing || !memories || memories.length === 0) {
    const mockStory = `This month, your bond became noticeably stronger and beautifully anchored. You learned more about each other's hidden fears than ever before, and you became incredibly skilled at predicting each other's thoughts. Every answered question added a bright chapter to your shared timeline!`;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return res.json({ story: mockStory });
  }

  try {
    const memoryDetails = memories.map((m: any, idx: number) => {
      return `Day ${idx + 1} (${m.date}) - Question: "${m.questionText}"\nUser: "${m.userAnswer}" | Partner: "${m.partnerAnswer}"\nAI commentary: "${m.aiCommentary}"`;
    }).join('\n\n');

    const prompt = `
      Review these memories shared by two best friends over the past few weeks:
      ${memoryDetails}
      Write a heartwarming, emotional, and deeply personalized Monthly Friendship Story (3-4 sentences). Format like a beautiful journal entry.
    `;

    const schemaDesc = `{ story: string }`;
    const data = await callGroqAPI(prompt, schemaDesc);
    return res.json(data);
  } catch (error) {
    console.error('Groq monthly story error:', error);
    res.status(500).json({ error: 'Failed to generate monthly story' });
  }
});

app.post('/api/ai/custom-questions', async (req, res) => {
  const { pastQuestions } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  if (isKeyMissing) {
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

    const schemaDesc = `{ questions: Array<{ id: string, text: string, category: string (one of: Friendship, Fun, Emotional, Deep Thinking, Future, Random), type: string (one of: self, prediction, rapid_fire), difficulty: string (one of: Easy, Medium, Deep) }> }`;
    const data = await callGroqAPI(prompt, schemaDesc);
    return res.json(data);
  } catch (error) {
    console.error('Groq custom questions error:', error);
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

// Periodically clean up rooms older than 1 hour from in-memory Map
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000; // 1 hour threshold
  let cleanedCount = 0;
  for (const [roomCode, room] of rooms.entries()) {
    if (room.lastUpdated && room.lastUpdated < oneHourAgo) {
      rooms.delete(roomCode);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cache Garbage Collector: Evicted ${cleanedCount} inactive rooms from memory.`);
  }
}, 600000); // Check every 10 minutes
