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
  pastQuestionTexts?: string[];
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
  bingoState?: any;
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
  { id: 'tot1', text: 'Coffee vs Tea', category: 'Fun', type: 'this_or_that', difficulty: 'Easy', options: ['Coffee ☕', 'Tea 🍵'] },
  { id: 'slf1', text: 'What is a small detail about my personality that you hope never changes?', category: 'Friendship', type: 'self', difficulty: 'Easy' },
  { id: 'prd1', text: 'What is my absolute favorite way to destress after a chaotic day?', category: 'Emotional', type: 'prediction', difficulty: 'Medium' },
  { id: 'mc1', text: 'What is our ultimate Friday night vibe?', category: 'Fun', type: 'multiple_choice', difficulty: 'Easy', options: ['Cozy movie binge 🍿', 'Cooking a fancy meal 🍝', 'Late night drive 🚗', 'Board game showdown 🎮'] },
  { id: 'eo1', text: 'Live in Space vs Live Underwater', category: 'Fun', type: 'either_or', difficulty: 'Easy', options: ['Live in Space 🚀', 'Live Underwater 🧜'] },
  { id: 'rm1', text: 'How do you react when someone cancels plans at the very last minute?', category: 'Emotional', type: 'reaction_meter', difficulty: 'Medium' },
  { id: 'sld1', text: 'How high is your social battery right now?', category: 'Deep Thinking', type: 'slider', difficulty: 'Medium' },
  { id: 'rnk1', text: 'Rank these dinner choices from favorite to least favorite:', category: 'Fun', type: 'ranking', difficulty: 'Easy', options: ['Pizza 🍕', 'Burger 🍔', 'Pasta 🍝', 'Biryani 🍛', 'Ice Cream 🍨'] },
  { id: 'emo1', text: 'Describe today using only emojis (Max 10).', category: 'Fun', type: 'emoji_only', difficulty: 'Easy' },
  { id: 'voc1', text: 'What is one thing you appreciate about our relationship today?', category: 'Deep Thinking', type: 'self', difficulty: 'Deep' }
];

// Calculate Scheduled Unlock Times
function getScheduledUnlockTime(index: number, baseDate?: Date): string {
  const d = baseDate ? new Date(baseDate) : new Date();
  const schedules = [
    { h: 7, m: 0 },
    { h: 9, m: 0 },
    { h: 11, m: 0 },
    { h: 13, m: 0 },
    { h: 15, m: 0 },
    { h: 17, m: 0 },
    { h: 18, m: 30 },
    { h: 20, m: 0 },
    { h: 21, m: 0 },
    { h: 22, m: 0 }
  ];
  
  const time = schedules[index] !== undefined ? schedules[index] : { h: 8 + index, m: 0 };

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hourStr = String(time.h).padStart(2, '0');
  const minStr = String(time.m).padStart(2, '0');

  return `${year}-${month}-${day}T${hourStr}:${minStr}:00`;
}

// Select unique, non-repeating questions (10 by default)
function getNonRepeatingQuestions(usedSet: Set<string>, count = 10): any[] {
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

// Fallback to choose random static questions from the static pool
function getRandomStaticQuestions(pastQuestionTexts: string[], count = 10): any[] {
  const normalizedPast = (pastQuestionTexts || []).map(t => t.trim().toLowerCase());
  let available = QUESTION_POOL.filter(q => !normalizedPast.includes((q.text || '').trim().toLowerCase()));
  if (available.length < count) {
    available = [...QUESTION_POOL];
  }
  return available.slice(0, count).map((q, idx) => ({
    id: `dq_${q.id}_${Date.now()}_${idx}`,
    ...q
  }));
}

// Helper to check if a question is duplicate
function isQuestionDuplicate(text: string, pastTexts: string[]): boolean {
  if (!pastTexts || pastTexts.length === 0) return false;
  const clean = (t: string) => t.trim().toLowerCase().replace(/[?.!,;:'"()\-]/g, '').replace(/\s+/g, ' ');
  const cleanedText = clean(text);
  return pastTexts.some(p => clean(p) === cleanedText);
}

// Helper to generate 3 alternative questions of a specific type
async function generateAlternatives(
  questionText: string,
  type: string,
  category: string,
  pastQuestionTexts: string[]
): Promise<any[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '') {
    return [];
  }

  const prompt = `
    You are Bondly's question-generation engine.
    The daily question "${questionText}" of type "${type}" and category "${category}" was already asked previously in our history.
    Generate exactly 3 alternative, highly engaging, and unique replacement questions of the SAME type ("${type}") and category ("${category}").
    Do not repeat or overlap with these past questions:
    ${pastQuestionTexts.length > 0 ? pastQuestionTexts.slice(-30).map((q, i) => `${i+1}. ${q}`).join('\n') : 'None'}

    Generate response matching the specified JSON schema. Do not include mock questions or placeholders.
  `;

  const schemaDesc = `{
    questions: Array<{
      text: string,
      category: string,
      type: string,
      difficulty: string,
      options?: Array<string>
    }>
  }`;

  try {
    const data = await callGroqAPI(prompt, schemaDesc);
    let questionsList: any[] = [];
    if (data && Array.isArray(data.questions)) {
      questionsList = data.questions;
    } else if (data && typeof data === 'object') {
      const firstArrayKey = Object.keys(data).find(k => Array.isArray((data as any)[k]));
      if (firstArrayKey) {
        questionsList = (data as any)[firstArrayKey];
      }
    }
    return questionsList.filter(
      q => q && typeof q === 'object' && typeof q.text === 'string' && q.text.trim() !== ''
    );
  } catch (e) {
    console.error('❌ Failed to generate alternatives:', e);
    return [];
  }
}

// Helper to generate a single batch of daily questions with retry logic
async function generateAIQuestionsBatch(
  prompt: string,
  schemaDesc: string,
  expectedCount: number,
  retries = 3
): Promise<any[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await callGroqAPI(prompt, schemaDesc);
      
      let questionsList: any[] = [];
      if (Array.isArray(data)) {
        questionsList = data;
      } else if (data && typeof data === 'object') {
        const firstArrayKey = Object.keys(data).find(k => Array.isArray((data as any)[k]));
        if (firstArrayKey) {
          questionsList = (data as any)[firstArrayKey];
        }
      }
      
      // Filter out invalid items (each question must have text)
      questionsList = questionsList.filter(
        q => q && typeof q === 'object' && typeof q.text === 'string' && q.text.trim() !== ''
      );
      
      if (questionsList.length > 0) {
        if (questionsList.length > expectedCount) {
          questionsList = questionsList.slice(0, expectedCount);
        }
        return questionsList;
      }
      throw new Error(`Batch returned no valid questions`);
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt} failed for AI question generation batch:`, error);
      if (attempt === retries) {
        throw error;
      }
      // Wait a short duration before retrying (exponential backoff / delay)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return [];
}

// Generates 10 unique daily questions via Groq API (llama-3.3-70b-versatile) by splitting into 2 parallel batches
async function generateAIQuestions(pastQuestionTexts: string[] = []): Promise<any[]> {
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  if (isKeyMissing) {
    console.warn('⚠️ Groq API key is missing. Falling back to static question pool.');
    return getRandomStaticQuestions(pastQuestionTexts);
  }

  try {
    const schemaDesc = `{
      questions: Array<{
        text: string,
        category: string (Friendship, Fun, Emotional, Deep Thinking, Future),
        type: string (this_or_that, self, prediction, multiple_choice, either_or, reaction_meter, slider, ranking, emoji_only),
        difficulty: string (Easy, Medium, Deep),
        options?: Array<string>
      }>
    }`;

    // Prompt for Batch 1 (Questions 1-5): Fast and reflective types
    const prompt1 = `
      You are Bondly's question-generation engine (Batch 1 of 2).
      Generate exactly 5 unique, highly engaging, and easy-to-understand daily questions for friends/partners.
      Do not repeat or overlap with these past questions:
      ${pastQuestionTexts.length > 0 ? pastQuestionTexts.map((q, i) => `${i+1}. ${q}`).join('\n') : 'None'}

      CRITICAL SEMANTIC DIVERSIFICATION RULES:
      - Every question must have a completely unique intention, theme, emotional tone, topic, and require a totally different thinking process.
      - There must be zero overlap or similarity in intentions or thoughts across the 5 questions.
      - If one question is about a daily routine, no other question can ask about daily habits.
      - If one question touches on food/restaurants, no other question can cover culinary topics.
      - If one question asks about childhood memories, no other question can cover nostalgia/past events.
      - Do not repeat any concepts, nouns, verbs, or semantic meanings across any of the questions. None of them should feel similar in intention or meaning.

      You MUST generate exactly 5 questions in a JSON array. Follow this exact order of formats/types:
      1. Index 0: type="this_or_that" (category="Fun" or "Friendship"). A fast choice. Text must be like "Coffee vs Tea" or "Cats vs Dogs". Include options=[item1, item2].
      2. Index 1: type="self" (category="Friendship" or "Fun"). A reflective question answered for oneself. E.g., "What is a personality detail about me you hope never changes?".
      3. Index 2: type="prediction" (category="Emotional" or "Friendship"). A question where one partner predicts the other's answer. E.g., "What is my absolute favorite way to destress after a chaotic day?".
      4. Index 3: type="multiple_choice" (category="Fun"). Include options=[option1, option2, option3, option4] (4 items with descriptive emojis).
      5. Index 4: type="either_or" (category="Fun" or "Deep Thinking"). Two big choices. Text must be like "Live in Space or Live Underwater". Include options=[choice1, choice2].

      FOCUS AREA & TOPIC LIMITATION:
      Only focus on simple preferences, personality quirks, habit predictions, and imaginary/sci-fi choices. Do NOT write questions about emotional reactions to events, numeric rating scales, priority rankings of multiple items, emoji-only representations of mood, or voice messages of appreciation/bedtime reflections.

      Generate response matching the specified JSON schema. Do not include mock questions or placeholders.
    `;

    // Prompt for Batch 2 (Questions 6-10): Interaction, meter, rating, and voice types
    const prompt2 = `
      You are Bondly's question-generation engine (Batch 2 of 2).
      Generate exactly 5 unique, highly engaging, and easy-to-understand daily questions for friends/partners.
      Do not repeat or overlap with these past questions:
      ${pastQuestionTexts.length > 0 ? pastQuestionTexts.map((q, i) => `${i+1}. ${q}`).join('\n') : 'None'}

      CRITICAL SEMANTIC DIVERSIFICATION RULES:
      - Every question must have a completely unique intention, theme, emotional tone, topic, and require a totally different thinking process.
      - There must be zero overlap or similarity in intentions or thoughts across the 5 questions.
      - If one question is about stress or daily battery, no other question can ask about emotional states.
      - Do not repeat any concepts, nouns, verbs, or semantic meanings across any of the questions. None of them should feel similar in intention or meaning.

      You MUST generate exactly 5 questions in a JSON array. Follow this exact order of formats/types:
      1. Index 0: type="reaction_meter" (category="Fun" or "Emotional"). A prompt requesting a reaction. E.g., "When someone cancels plans at the last minute".
      2. Index 1: type="slider" (category="Emotional" or "Deep Thinking"). An opinion rating question from 0 to 100. E.g., "How stressful was today?" or "How high is your battery today?".
      3. Index 2: type="ranking" (category="Fun" or "Friendship"). Rank 5 items. Include options=[item1, item2, item3, item4, item5] (e.g. Pizza, Burger, etc.).
      4. Index 3: type="emoji_only" (category="Fun" or "Emotional"). A prompt to describe something using only emojis. E.g., "Describe today using only emojis." or "Describe your mood using only emojis.".
      5. Index 4: type="self" (category="Deep Thinking" or "Emotional"). A deep bedtime question. E.g., "What is one thing you appreciate about our relationship today?" or "Share a sweet memory you thought of today.".

      FOCUS AREA & TOPIC LIMITATION:
      Only focus on emotional reactions, numeric ratings, ranking items, emoji representation of moods, and bedtime messages of appreciation/memories. Do NOT write questions about simple preferences (like coffee vs tea), general personality reflection, imaginary sci-fi either/or scenarios, or standard multiple-choice questions.

      Generate response matching the specified JSON schema. Do not include mock questions or placeholders.
    `;

    // Fetch both batches in parallel
    const [batch1, batch2] = await Promise.all([
      generateAIQuestionsBatch(prompt1, schemaDesc, 5).catch(e => {
        console.error('❌ Batch 1 question generation failed completely after retries:', e);
        return [] as any[];
      }),
      generateAIQuestionsBatch(prompt2, schemaDesc, 5).catch(e => {
        console.error('❌ Batch 2 question generation failed completely after retries:', e);
        return [] as any[];
      })
    ]);

    let combinedQuestions = [...batch1, ...batch2];

    // Safety fallback: if both batches failed and returned absolutely 0 questions, we fall back to static questions
    if (combinedQuestions.length === 0) {
      console.warn('⚠️ Both AI batches failed completely. Falling back to static question pool.');
      return getRandomStaticQuestions(pastQuestionTexts);
    }

    // Check each generated question for duplicates against pastQuestionTexts
    for (let i = 0; i < combinedQuestions.length; i++) {
      const q = combinedQuestions[i];
      if (isQuestionDuplicate(q.text, pastQuestionTexts)) {
        console.log(`🔍 Detected duplicate question text: "${q.text}". Generating alternatives...`);
        const alternatives = await generateAlternatives(q.text, q.type, q.category, pastQuestionTexts);
        
        // Find the first alternative that is NOT a duplicate
        let replacement = alternatives.find(alt => !isQuestionDuplicate(alt.text, pastQuestionTexts));
        
        // If we found a unique replacement, use it
        if (replacement) {
          console.log(`✅ Replaced duplicate question with: "${replacement.text}"`);
          combinedQuestions[i] = replacement;
        } else if (alternatives.length > 0) {
          // If all alternatives were duplicates (extremely rare), fallback to the first alternative instead of looping again
          console.warn(`⚠️ All generated alternatives were duplicates. Falling back to first alternative: "${alternatives[0].text}"`);
          combinedQuestions[i] = alternatives[0];
        }
      }
    }

    return combinedQuestions.map((q: any, idx: number) => ({
      id: q.id && (q.id.startsWith('ai_') || q.id.startsWith('dq_')) ? q.id : `ai_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      ...q
    }));
  } catch (error) {
    console.error('❌ AI question generation error:', error);
    return getRandomStaticQuestions(pastQuestionTexts);
  }
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
    bingoState: room.bingoState || null,
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
    let score = 85;
    let commentary = `You both shared wonderful thoughts in the ${category} category!`;

    if (type === 'multiple_choice' || type === 'this_or_that' || type === 'either_or' || type === 'reaction_meter') {
      const isMatch = (userAnswer || '').trim().toLowerCase() === (partnerAnswer || '').trim().toLowerCase();
      return {
        similarityScore: isMatch ? 100 : 60,
        aiCommentary: isMatch
          ? `Perfect Choice Match! You both selected "${userAnswer}". Total alignment!`
          : `Choice Match: You selected "${userAnswer}" while your partner chose "${partnerAnswer}". Unique preferences make your bond interesting!`
      };
    }

    if (type === 'slider') {
      const val1 = parseInt(userAnswer, 10) || 0;
      const val2 = parseInt(partnerAnswer, 10) || 0;
      const diff = Math.abs(val1 - val2);
      score = Math.max(0, 100 - diff);
      if (diff <= 10) {
        commentary = `Wow, you are almost in perfect sync with a difference of just ${diff} points on the scale (You: ${val1}, Partner: ${val2})!`;
      } else {
        commentary = `You rate this somewhat differently, with a difference of ${diff} points (You: ${val1}, Partner: ${val2}). Opposite views spark the best conversations!`;
      }
      return { similarityScore: score, aiCommentary: commentary };
    }

    if (type === 'ranking') {
      try {
        const r1 = (userAnswer || '').split(',').map(s => s.trim().toLowerCase());
        const r2 = (partnerAnswer || '').split(',').map(s => s.trim().toLowerCase());
        let rankScore = 0;
        r1.forEach((item, idx) => {
          const partnerIdx = r2.indexOf(item);
          if (partnerIdx !== -1) {
            const diff = Math.abs(idx - partnerIdx);
            if (diff === 0) rankScore += 20;
            else if (diff === 1) rankScore += 12;
            else if (diff === 2) rankScore += 6;
          }
        });
        score = Math.min(100, Math.max(50, rankScore));
        commentary = `Rankings compared! You both ranked the items with a high degree of correlation (${score}% alignment). Check out where your lists overlap!`;
      } catch (e) {
        score = 80;
        commentary = `Rankings submitted! Reviewing each other's list offers a wonderful window into your priorities.`;
      }
      return { similarityScore: score, aiCommentary: commentary };
    }

    if (type === 'emoji_only') {
      return {
        similarityScore: 90,
        aiCommentary: `Both of you shared expressive emoji reflections ("${userAnswer}" & "${partnerAnswer}") detailing your daily energy!`
      };
    }

    if (type === 'prediction') {
      const p1 = (userPrediction || '').toLowerCase().trim();
      const p2 = (partnerPrediction || '').toLowerCase().trim();
      if (p1 && p2) {
        const isOverlap = p1 === p2 || p1.includes(p2) || p2.includes(p1);
        score = isOverlap ? 96 : 85;
        commentary = isOverlap
          ? `Incredible alignment! Your predictions perfectly match. This shows an amazing intuitive connection.`
          : `Predictions submitted! Reviewing each other's predictions offers a wonderful window into how you understand one another.`;
      } else {
        score = 60;
        commentary = `Waiting for both predictions to be submitted.`;
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
      Evaluate the similarity, alignment, and emotional connection between these two answers:
      
      Question Text: "${questionText}"
      Category: "${category}"
      Challenge Type: "${type}"
      
      User 1 Answer: "${type === 'prediction' ? userPrediction : userAnswer}"
      User 2 Answer: "${type === 'prediction' ? partnerPrediction : partnerAnswer}"
      
      For types like multiple_choice, this_or_that, either_or, and reaction_meter, note if they chose the same item.
      For type="slider", note their numeric ratings (0-100) and comment on how close or far apart they are.
      For type="ranking", evaluate how similar their ranked priorities are.
      For type="emoji_only", interpret the meaning of both users' emoji strings and summarize their combined day or feelings.
      
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

  const picked = await generateAIQuestions([]);

  const roomQuestions: RoomQuestion[] = picked.map((q, idx) => ({
    id: q.id.startsWith('dq_') || q.id.startsWith('ai_') ? q.id : `dq_${q.id}_${Date.now()}`,
    questionId: q.id,
    text: q.text,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty || 'Medium',
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
    usedQuestionIds: picked.map(q => q.id),
    pastQuestionTexts: [],
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

    // Completely drop Memory Vault (no archiving to room.memories)
    room.memories = [];

    // Ensure room.pastQuestionTexts exists
    room.pastQuestionTexts = room.pastQuestionTexts || [];

    // Save yesterday's questions to the room's permanent history
    if (room.dailySession && room.dailySession.questions) {
      room.dailySession.questions.forEach(q => {
        if (q.text && !room.pastQuestionTexts!.includes(q.text)) {
          room.pastQuestionTexts!.push(q.text);
        }
      });
    }

    // Keep history capped at last 100 questions to prevent any database size issues
    if (room.pastQuestionTexts.length > 100) {
      room.pastQuestionTexts = room.pastQuestionTexts.slice(-100);
    }

    const picked = await generateAIQuestions(room.pastQuestionTexts);
    const todayDate = new Date();

    const roomQuestions: RoomQuestion[] = picked.map((q, idx) => ({
      id: q.id.startsWith('dq_') || q.id.startsWith('ai_') ? q.id : `dq_${q.id}_${Date.now()}`,
      questionId: q.id,
      text: q.text,
      category: q.category,
      type: q.type,
      difficulty: q.difficulty || 'Medium',
      options: q.options,
      unlockTime: getScheduledUnlockTime(idx, todayDate),
    }));

    room.currentDate = todayStr;
    room.usedQuestionIds = Array.from(new Set([...(room.usedQuestionIds || []), ...picked.map(q => q.id)]));
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
// BINGO MULTIPLAYER ROUTING & LOGIC
// -------------------------------------------------------------

const BINGO_WINNING_LINES = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

function checkBingoLines(board: string[], markedItems: string[]): number[] {
  if (!board || !markedItems) return [];
  const markedSet = new Set(markedItems.map(item => item.trim().toLowerCase()));
  const completedIndices: number[] = [];

  BINGO_WINNING_LINES.forEach((line, index) => {
    const isCompleted = line.every(cellIdx => {
      const val = board[cellIdx];
      return val && markedSet.has(val.trim().toLowerCase());
    });
    if (isCompleted) {
      completedIndices.push(index);
    }
  });

  return completedIndices;
}

function calculateScore(completedCount: number): number {
  let score = 0;
  if (completedCount >= 1) score += 50; // 1st line
  if (completedCount >= 2) score += 50; // 2nd line
  if (completedCount >= 3) score += 75; // 3rd line
  if (completedCount >= 4) score += 75; // 4th line
  if (completedCount >= 5) score += 200; // Full house / 5+ lines
  return score;
}

const DEFAULT_BINGO_KEYWORDS = [
  "Pizza 🍕", "Long Walks 🚶", "Tea/Coffee ☕", "Netflix Binge 📺",
  "Late Night Chats 💬", "Inside Joke 🤫", "Road Trip 🚗", "Beach Day 🏖️",
  "Cooking Disasters 🍳", "Goa Trip 🌴", "Memes Sent 📱", "Rainy Days 🌧️",
  "Shopping Spree 🛍️", "Sleeping In 😴", "Deep Fears 👻", "Big Dreams 🌟",
  "First Impression 🤝", "Gaming Nights 🎮", "Comfort Food 🍔", "Music Playlists 🎵",
  "Future Plans 🏡", "Funny Faces 😜", "Gym Partner 🏋️", "Ice Cream 🍦", "Star Gazing ✨"
];

async function generateBingoKeywords(room: ServerRoom): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_GROQ_API_KEY' || apiKey.trim() === '';

  const memoriesList = room.memories || [];
  const memoryTexts = memoriesList.map((m: any) => {
    return `Question: ${m.questionText}. Answers: ${m.userAnswer}, ${m.partnerAnswer}`;
  }).join(' | ');

  if (isKeyMissing || memoriesList.length === 0) {
    return [...DEFAULT_BINGO_KEYWORDS].sort(() => Math.random() - 0.5);
  }

  try {
    const prompt = `
      We are playing a friendship/relationship BINGO game called Bondly BINGO.
      Generate exactly 25 unique, short, and highly relatable friendship/relationship keywords or memories (1-3 words max, each must contain a single matching emoji, e.g. "Pizza 🍕" or "Rainy Days 🌧️" or "Inside Joke 🤫").
      Base these keywords on the following shared memories/answers between the two partners:
      "${memoryTexts.substring(0, 1000)}"

      If there are not enough specific memories, fill in the rest using typical fun, warm, and exciting friendship concepts (e.g. food, travel, inside jokes, hobbies).
      Generate the response matching the specified JSON schema.
    `;

    const schemaDesc = `{
      keywords: Array<string> (exactly 25 items, each 1-3 words with an emoji)
    }`;

    const data = await callGroqAPI(prompt, schemaDesc);
    if (data && Array.isArray(data.keywords) && data.keywords.length === 25) {
      return data.keywords;
    }
    throw new Error("Invalid array size from AI");
  } catch (e) {
    console.warn("AI Bingo keyword generation failed, using defaults:", e);
    const customList = new Set<string>();
    memoriesList.forEach((m: any) => {
      if (m.questionText && m.questionText.length < 50) {
        const cleaned = m.questionText.replace(/[?.,!]/g, "").substring(0, 15);
        customList.add(cleaned);
      }
    });

    const merged = Array.from(customList).map(text => `${text} ✨`);
    DEFAULT_BINGO_KEYWORDS.forEach(kw => {
      if (merged.length < 25) {
        merged.push(kw);
      }
    });
    return merged.sort(() => Math.random() - 0.5);
  }
}

// API: Start BINGO Game
app.post('/api/rooms/:roomCode/bingo/start', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = req.body.slot || 'user1';
  const room = await fetchRoom(cleanCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const keywords = await generateBingoKeywords(room);

  const boardUser1 = [...keywords].sort(() => Math.random() - 0.5);
  const boardUser2 = [...keywords].sort(() => Math.random() - 0.5);

  room.bingoState = {
    gameActive: true,
    currentTurn: Math.random() < 0.5 ? 'user1' : 'user2',
    boardUser1,
    boardUser2,
    markedItems: [],
    completedLinesUser1: [],
    completedLinesUser2: [],
    scores: {
      user1: 0,
      user2: 0
    },
    winner: null,
    lastActionDesc: 'A new AI BINGO match has started!'
  };

  room.lastUpdated = Date.now();
  await persistRoom(room);
  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Call a BINGO memory
app.post('/api/rooms/:roomCode/bingo/call', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const { slot, item } = req.body;
  const room = await fetchRoom(cleanCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const state = room.bingoState;
  if (!state || !state.gameActive) {
    return res.status(400).json({ error: 'No active BINGO game' });
  }

  if (state.currentTurn !== slot) {
    return res.status(400).json({ error: 'Not your turn' });
  }

  if (state.winner) {
    return res.status(400).json({ error: 'Game already finished' });
  }

  const callerName = slot === 'user1' ? (room.user1?.name || 'User 1') : (room.user2?.name || 'User 2');

  if (!state.markedItems.includes(item)) {
    state.markedItems.push(item);
  }

  state.lastActionDesc = `${callerName} called "${item}"!`;

  state.completedLinesUser1 = checkBingoLines(state.boardUser1, state.markedItems);
  state.completedLinesUser2 = checkBingoLines(state.boardUser2, state.markedItems);

  state.scores.user1 = calculateScore(state.completedLinesUser1.length);
  state.scores.user2 = calculateScore(state.completedLinesUser2.length);

  const allMarked = state.markedItems.length >= 25;
  const user1Win = state.completedLinesUser1.length >= 5;
  const user2Win = state.completedLinesUser2.length >= 5;

  if (user1Win && user2Win) {
    state.winner = 'draw';
    state.gameActive = false;
    state.lastActionDesc = `It's a draw! Both players hit 5 completed lines.`;
  } else if (user1Win) {
    state.winner = 'user1';
    state.gameActive = false;
    state.lastActionDesc = `${room.user1?.name || 'User 1'} hit BINGO! 🎉`;
  } else if (user2Win) {
    state.winner = 'user2';
    state.gameActive = false;
    state.lastActionDesc = `${room.user2?.name || 'User 2'} hit BINGO! 🎉`;
  } else if (allMarked) {
    if (state.completedLinesUser1.length > state.completedLinesUser2.length) {
      state.winner = 'user1';
    } else if (state.completedLinesUser2.length > state.completedLinesUser1.length) {
      state.winner = 'user2';
    } else {
      state.winner = 'draw';
    }
    state.gameActive = false;
    state.lastActionDesc = `Board cleared! Winner: ${state.winner === 'draw' ? 'Draw' : (state.winner === 'user1' ? room.user1?.name : room.user2?.name)}`;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (state.winner && state.winner !== 'draw') {
    const winnerProfile = state.winner === 'user1' ? room.user1 : room.user2;
    const loserProfile = state.winner === 'user1' ? room.user2 : room.user1;
    
    // Reward XP/streak milestones on win
    if (winnerProfile) {
      winnerProfile.streakCount = (winnerProfile.streakCount || 0) + 1;
    }
    
    room.timeline.unshift({
      id: `evt_bingo_win_${Date.now()}`,
      title: 'BINGO Champion! 🏆',
      description: `${winnerProfile?.name || 'Winner'} won AI Friendship BINGO against ${loserProfile?.name || 'Partner'}!`,
      date: todayStr,
      type: 'milestone',
      icon: '🏆'
    });
  }

  state.currentTurn = slot === 'user1' ? 'user2' : 'user1';

  room.lastUpdated = Date.now();
  await persistRoom(room);
  return res.json({ roomState: formatRoomForSlot(room, slot) });
});

// API: Reset BINGO Game
app.post('/api/rooms/:roomCode/bingo/reset', async (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const slot = req.body.slot || 'user1';
  const room = await fetchRoom(cleanCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.bingoState = null;
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
  const { pastQuestions } = req.body; // array of question texts or IDs
  try {
    const questions = await generateAIQuestions(pastQuestions || []);
    return res.json({ questions });
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
