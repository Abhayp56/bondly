import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Sparkles, CheckCircle2, ChevronRight, HelpCircle, 
  RefreshCw, Award, ArrowRight, Heart, Flame, ShieldAlert, Zap, Clock,
  Mic, Trash2, Play, Pause, Volume2
} from 'lucide-react';
import { Profile, DailyQuestion, DailySession, Memory } from '../types';
import confetti from 'canvas-confetti';
import { getApiUrl } from '../config';
import { supabase } from '../lib/supabaseClient';

interface DailyQuestionsProps {
  profile: Profile;
  dailySession: DailySession | null;
  onUpdateSession: (updatedSession: DailySession) => void;
}

const SCHEDULE_LABELS = [
  'Morning Kickoff (7:00 AM) 🌅',
  'Daily Intention (9:00 AM) 🚗',
  'Mid-Morning (11:00 AM) ☕',
  'Lunch Time (1:00 PM) 🥪',
  'Afternoon Slump (3:00 PM) ⚡',
  'End of Workday (5:00 PM) 🌇',
  'Dinner Vibes (6:30 PM) 🍽️',
  'Evening Chill (8:00 PM) 🛋️',
  'Night Reflection (9:00 PM) 🌙',
  'Cozy Bedtime (10:00 PM) 🌌'
];

export default function DailyQuestionsView({ 
  profile, 
  dailySession, 
  onUpdateSession 
}: DailyQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [userExplanation, setUserExplanation] = useState('');
  const [userPrediction, setUserPrediction] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // Ranking state
  const [rankedItems, setRankedItems] = useState<string[]>([]);

  // Active Question
  const activeQuestion: DailyQuestion | undefined = dailySession?.questions[currentIndex];

  useEffect(() => {
    if (activeQuestion) {
      setUserAnswer(activeQuestion.userAnswer || '');
      setUserExplanation(activeQuestion.userExplanation || '');
      setUserPrediction(activeQuestion.userPrediction || '');
      const bothDone = activeQuestion.answeredByUser && activeQuestion.answeredByPartner;
      setShowReveal(bothDone);
      setIsFlipped(bothDone);
      setErrMsg('');


      // Ranking items initialize
      if (activeQuestion.type === 'ranking') {
        const initial = activeQuestion.userAnswer 
          ? activeQuestion.userAnswer.split(',') 
          : (activeQuestion.options || ['Pizza 🍕', 'Burger 🍔', 'Pasta 🍝', 'Biryani 🍛', 'Ice Cream 🍨']);
        setRankedItems(initial);
        if (!activeQuestion.answeredByUser) {
          setUserAnswer(initial.join(','));
        }
      }
    }
  }, [currentIndex, activeQuestion?.id]);

  if (!dailySession || !activeQuestion) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-vborder shadow-sm space-y-3">
        <ShieldAlert className="w-10 h-10 text-vcoral mx-auto" />
        <h3 className="font-bold text-vcharcoal text-sm">No active daily session</h3>
        <p className="text-xs text-vgray">Session is loading or initializing...</p>
      </div>
    );
  }

  // Helper to reliably compute local scheduled unlock time for target slot hours
  const getQuestionUnlockDate = (qUnlockTime: string, idx: number): Date => {
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
    const time = schedules[idx] || { h: 8 + idx, m: 0 };
    const now = new Date();

    if (!qUnlockTime) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.h, time.m, 0);
    }

    if (!qUnlockTime.endsWith('Z') && qUnlockTime.includes('T')) {
      const parsed = new Date(qUnlockTime);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.h, time.m, 0);
  };


  // Ranking Swap Function
  const moveRank = (index: number, direction: number) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= rankedItems.length) return;
    const newOrder = [...rankedItems];
    const temp = newOrder[index];
    newOrder[index] = newOrder[nextIdx];
    newOrder[nextIdx] = temp;
    setRankedItems(newOrder);
    setUserAnswer(newOrder.join(','));
  };

  const unlockDate = getQuestionUnlockDate(activeQuestion.unlockTime, currentIndex);
  const isLocked = unlockDate > new Date();
  const formattedUnlockTime = unlockDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Trigger answer submission
  const handleSubmitAnswer = async () => {
    if (isLocked) {
      setErrMsg(`This prompt unlocks today at ${formattedUnlockTime}!`);
      return;
    }

    if (activeQuestion.type === 'prediction' && !userPrediction.trim()) return;
    if (activeQuestion.type !== 'prediction' && !userAnswer.trim()) return;

    // Emoji-Only validation
    if (activeQuestion.type === 'emoji_only') {
      const clean = userAnswer.replace(/\s+/g, '');
      const charCount = [...clean].length;
      if (charCount === 0) {
        setErrMsg('Please enter at least 1 emoji!');
        return;
      }
      if (charCount > 10) {
        setErrMsg('Maximum of 10 emojis allowed!');
        return;
      }
      const containsText = /[a-zA-Z0-9]/g.test(userAnswer);
      if (containsText) {
        setErrMsg('Only emojis are allowed in this prompt!');
        return;
      }
    }

    setIsSubmitting(true);
    setErrMsg('');

    let finalAnswer = userAnswer;

    try {
      if (profile.roomCode) {
        // Submit answer to real-time room backend
        const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}/answer`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: profile.slot || 'user1',
            questionIndex: currentIndex,
            answer: finalAnswer,
            explanation: userExplanation,
            prediction: userPrediction
          })
        });

        if (res.ok) {
          const data = await res.json();
          onUpdateSession(data.roomState.dailySession);
          
          const updatedQ = data.roomState.dailySession.questions[currentIndex];
          if (updatedQ.answeredByUser && updatedQ.answeredByPartner) {
            setShowReveal(true);
            setTimeout(() => setIsFlipped(true), 300);
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.75 } });
          }
        } else {
          const errData = await res.json();
          setErrMsg(errData.error || 'Failed to submit answer.');
        }
      } else {
        // AI Companion Mode
        let updatedQuestion = { ...activeQuestion };

        if (activeQuestion.type === 'prediction') {
          updatedQuestion.userPrediction = userPrediction;
          updatedQuestion.answeredByUser = true;
        } else {
          updatedQuestion.userAnswer = finalAnswer;
          updatedQuestion.userExplanation = userExplanation;
          updatedQuestion.answeredByUser = true;
        }

        if (profile.partnerCode === 'AI-GEMINI') {
          const response = await fetch(getApiUrl('/api/ai/reveal'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionText: activeQuestion.text,
              category: activeQuestion.category,
              type: activeQuestion.type,
              userAnswer: finalAnswer,
              partnerAnswer: 'Simulated AI Answer',
              userPrediction: userPrediction,
              partnerPrediction: ''
            })
          });

          if (response.ok) {
            const aiResult = await response.json();
            let partnerAns = "I really appreciate how we can talk about anything and support each other no matter what.";
            if (activeQuestion.type === 'slider') partnerAns = "72";
            else if (activeQuestion.type === 'ranking') partnerAns = rankedItems.slice().reverse().join(',');
            else if (activeQuestion.type === 'reaction_meter') partnerAns = '😍 Love';
            else if (activeQuestion.type === 'this_or_that' || activeQuestion.type === 'either_or') partnerAns = activeQuestion.options?.[0] || 'Coffee';
            else if (activeQuestion.type === 'emoji_only') partnerAns = '😴☕️💻🚶‍♂️😴';
            else if (activeQuestion.category === 'Fun') partnerAns = "I would definitely try to lock us inside a huge store with infinite snacks!";
            else if (activeQuestion.category === 'Friendship') partnerAns = "Your empathy and ability to always listen without judgment.";

            updatedQuestion.partnerAnswer = partnerAns;
            updatedQuestion.answeredByPartner = true;
            updatedQuestion.similarityScore = aiResult.similarityScore;
            updatedQuestion.aiCommentary = aiResult.aiCommentary;
          }
        }

        const updatedQuestions = dailySession.questions.map((q, idx) => 
          idx === currentIndex ? updatedQuestion : q
        );
        const updatedSession = { ...dailySession, questions: updatedQuestions };
        onUpdateSession(updatedSession);

        if (updatedQuestion.answeredByUser && updatedQuestion.answeredByPartner) {
          setShowReveal(true);
          setTimeout(() => setIsFlipped(true), 300);
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.75 } });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBothAnswered = activeQuestion.answeredByUser && activeQuestion.answeredByPartner;
  const isWaitingPartner = activeQuestion.answeredByUser && !activeQuestion.answeredByPartner;

  return (
    <div className="space-y-4">
      
      {/* Question Progress Selector Pill Bar & Clear Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex space-x-1.5 overflow-x-auto py-1 scrollbar-none flex-1">
          {dailySession.questions.map((q, idx) => {
            const isDone = q.answeredByUser && q.answeredByPartner;
            const isPending = q.answeredByUser && !q.answeredByPartner;
            const isQLocked = getQuestionUnlockDate(q.unlockTime, idx) > new Date();
            const isActive = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 flex items-center space-x-1 cursor-pointer ${
                  isActive
                    ? 'bg-vcoral text-white shadow-md shadow-rose-500/20'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : isPending
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : isQLocked
                    ? 'bg-vsoft/60 text-vgray border border-vborder'
                    : 'bg-white text-vgray border border-vborder hover:bg-vsoft'
                }`}
              >
                <span>{idx + 1}</span>
                <span>{isDone ? '✓' : isPending ? '⏳' : isQLocked ? '🔒' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card Stack */}
      <div className="relative">
        <motion.div
          key={activeQuestion.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-vborder rounded-[32px] p-6 space-y-5 shadow-sm relative overflow-hidden"
        >
          {/* Top Header Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 bg-vsoft text-vcoral border border-vsoft-border rounded-full text-[10px] font-extrabold tracking-wider uppercase max-w-[75%] truncate">
              {activeQuestion.category} • {activeQuestion.type === 'multiple_choice' ? 'Choice Match 🎯' : activeQuestion.type === 'prediction' ? 'Prediction Challenge 🎯' : 'Self Reflection 💖'}
            </span>

            <span className="text-[10px] font-bold text-vgray uppercase shrink-0">
              {SCHEDULE_LABELS[currentIndex] || `Prompt ${currentIndex + 1}`}
            </span>
          </div>

          {/* Question Title */}
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-vcharcoal font-display leading-snug">
              {activeQuestion.text}
            </h3>
            {activeQuestion.type === 'multiple_choice' ? (
              <p className="text-xs text-vcoral font-semibold">
                Select your answer option and find out if <span className="underline">{profile.partnerName}</span> picks the exact same one!
              </p>
            ) : activeQuestion.type === 'prediction' ? (
              <p className="text-xs text-vcoral font-semibold">
                Predict what <span className="underline">{profile.partnerName}</span> would say to this question!
              </p>
            ) : null}
          </div>

          {/* Card Body - Locked Time Screen or Form / Results */}
          {isLocked ? (
            /* LOCKED TIME SCREEN */
            <div className="p-6 bg-vsoft/50 border border-vsoft-border rounded-3xl text-center space-y-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white border border-vsoft-border text-vcoral flex items-center justify-center mx-auto shadow-sm text-xl">
                🔒
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-vcharcoal font-display">Prompt Scheduled</h4>
                <p className="text-xs text-vgray font-medium leading-relaxed">
                  This prompt is scheduled to unlock today at <span className="font-bold text-vcoral">{formattedUnlockTime}</span>.
                </p>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-vsoft-border text-[11px] font-bold text-vcharcoal flex items-center justify-center space-x-1.5">
                <Clock className="w-4 h-4 text-vcoral" />
                <span>Unlocks at {formattedUnlockTime} — Check back then with {profile.partnerName}!</span>
              </div>
            </div>
          ) : !isBothAnswered ? (
            /* ACTIVE ANSWER INPUT */
            <div className="space-y-4 pt-1">

              {errMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold text-center">
                  {errMsg}
                </div>
              )}

              {/* Form Input or One-Time Locked Submitted Answer */}
              {activeQuestion.answeredByUser ? (
                /* ONE-TIME LOCKED SUBMITTED ANSWER DISPLAY */
                <div className="p-5 bg-vsoft/60 border border-vsoft-border rounded-3xl space-y-3 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-lg font-bold border border-emerald-200">
                    🔒
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-vcharcoal uppercase tracking-wider">
                      Response Submitted & Locked
                    </h4>
                    <p className="text-[11px] text-vgray font-medium">
                      Answers are final once submitted and cannot be changed.
                    </p>
                  </div>
                  <div className="p-3.5 bg-white rounded-2xl border border-vsoft-border text-left space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-vcoral">Your Saved Response</span>
                    <p className="text-xs font-bold text-vcharcoal">
                      `"${activeQuestion.type === 'prediction' ? activeQuestion.userPrediction : activeQuestion.userAnswer}"`
                    </p>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] font-bold text-amber-800 flex items-center justify-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Waiting for {profile.partnerName} to submit response...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeQuestion.type === 'multiple_choice' ? (
                    <div className="space-y-2.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Select Your Choice:
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {(activeQuestion.options || [
                          'Cozy Mountain Cabin 🏔️',
                          'Sunny Beach Resort 🏖️',
                          'Bustling City Hotel 🏙️',
                          'Peaceful Forest Camping 🌲'
                        ]).map((option) => {
                          const isSelected = userAnswer === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setUserAnswer(option)}
                              className={`p-3.5 rounded-2xl text-xs font-bold text-left border transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-50 border-vcoral text-vcoral shadow-sm ring-1 ring-vcoral'
                                  : 'bg-vsoft/40 border-vsoft-border text-vcharcoal hover:bg-white hover:border-vcoral/40'
                              }`}
                            >
                              <span>{option}</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-vcoral bg-vcoral text-white' : 'border-vgray/40'}`}>
                                {isSelected && <span className="text-[10px]">✓</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeQuestion.type === 'this_or_that' ? (
                    <div className="space-y-2.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Select One (This or That):
                      </label>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {(activeQuestion.options || ['Coffee ☕', 'Tea 🍵']).map((option) => {
                          const isSelected = userAnswer === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setUserAnswer(option)}
                              className={`py-3.5 px-4 rounded-full text-xs font-bold text-center border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-50 border-vcoral text-vcoral shadow-sm shadow-rose-500/10'
                                  : 'bg-vsoft/30 border-vsoft-border text-vcharcoal hover:bg-white'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeQuestion.type === 'either_or' ? (
                    <div className="space-y-2.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Make Your Choice (Either / Or):
                      </label>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {(activeQuestion.options || ['Live in Space 🚀', 'Live Underwater 🧜']).map((option) => {
                          const isSelected = userAnswer === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setUserAnswer(option)}
                              className={`aspect-[4/3] p-4 rounded-3xl text-xs font-extrabold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-50 border-vcoral text-vcoral scale-102 shadow-md shadow-rose-500/10'
                                  : 'bg-vsoft/30 border-vsoft-border text-vcharcoal hover:bg-white'
                              }`}
                            >
                              <span className="text-2xl mb-2">{option.split(' ').slice(1).join(' ') || '❓'}</span>
                              <span className="text-[10px] text-center leading-tight">{option.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeQuestion.type === 'slider' ? (
                    <div className="space-y-2.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Rate Your Opinion:
                      </label>
                      <div className="p-4 bg-vsoft/40 border border-vsoft-border rounded-3xl space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-vgray">
                          <span>0</span>
                          <span className="text-xs text-vcoral bg-white px-3 py-1 rounded-full border border-vborder font-black">
                            {userAnswer || '50'}
                          </span>
                          <span>100</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={userAnswer || '50'}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-vcoral"
                        />
                      </div>
                    </div>
                  ) : activeQuestion.type === 'reaction_meter' ? (
                    <div className="space-y-2.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Choose Your Reaction:
                      </label>
                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {[
                          { emoji: '😍', label: 'Love' },
                          { emoji: '😊', label: 'Like' },
                          { emoji: '😐', label: 'Neutral' },
                          { emoji: '😖', label: 'Dislike' },
                          { emoji: '😡', label: 'Hate' }
                        ].map((reaction) => {
                          const val = `${reaction.emoji} ${reaction.label}`;
                          const isSelected = userAnswer === val;
                          return (
                            <button
                              key={reaction.label}
                              type="button"
                              onClick={() => setUserAnswer(val)}
                              className={`p-2 rounded-2xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-50 border-vcoral text-vcoral scale-105 shadow-sm'
                                  : 'bg-vsoft/30 border-vsoft-border text-vcharcoal hover:bg-white'
                              }`}
                            >
                              <span className="text-xl">{reaction.emoji}</span>
                              <span className="text-[8px] font-extrabold mt-1 text-vcharcoal leading-none truncate w-full">{reaction.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeQuestion.type === 'ranking' ? (
                    <div className="space-y-2 pt-1">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1">
                        Order the Items (use buttons to rank):
                      </label>
                      {rankedItems.map((item, idx) => (
                        <div key={item} className="flex items-center justify-between p-3 bg-vsoft/30 border border-vsoft-border rounded-2xl text-xs font-bold text-vcharcoal">
                          <div className="flex items-center space-x-3">
                            <span className="w-5 h-5 rounded-full bg-vcoral text-white flex items-center justify-center text-[10px] font-black">
                              {idx + 1}
                            </span>
                            <span className="truncate max-w-[150px]">{item}</span>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveRank(idx, -1)}
                              className="w-7 h-7 rounded-xl bg-white border border-vborder text-vcharcoal hover:bg-vsoft flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === rankedItems.length - 1}
                              onClick={() => moveRank(idx, 1)}
                              className="w-7 h-7 rounded-xl bg-white border border-vborder text-vcharcoal hover:bg-vsoft flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeQuestion.type === 'emoji_only' ? (
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                        Your Answer (Emojis Only - Max 10)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          className="w-full p-4 bg-vsoft/40 border border-vsoft-border rounded-2xl text-xl font-bold text-vcharcoal focus:outline-none focus:border-vcoral focus:bg-white transition-all text-center"
                          placeholder="🔥❤️😍🍕🌟"
                        />
                        <span className="absolute right-3.5 bottom-3.5 text-[9px] font-bold text-vgray">
                          {Array.from(userAnswer.replace(/\s+/g, '')).length} / 10
                        </span>
                      </div>
                    </div>
                  ) : activeQuestion.type === 'prediction' ? (
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                        Your Prediction of {profile.partnerName}'s Answer
                      </label>
                      <textarea
                        rows={3}
                        value={userPrediction}
                        onChange={(e) => setUserPrediction(e.target.value)}
                        className="w-full p-4 bg-vsoft/40 border border-vsoft-border rounded-2xl text-xs font-bold text-vcharcoal focus:outline-none focus:border-vcoral focus:bg-white transition-all resize-none"
                        placeholder={`What do you think ${profile.partnerName} will say?`}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                          Your Answer
                        </label>
                        <textarea
                          rows={3}
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          className="w-full p-4 bg-vsoft/40 border border-vsoft-border rounded-2xl text-xs font-bold text-vcharcoal focus:outline-none focus:border-vcoral focus:bg-white transition-all resize-none"
                          placeholder="Type your honest answer..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                          Optional Context / Memory (Optional)
                        </label>
                        <input
                          type="text"
                          value={userExplanation}
                          onChange={(e) => setUserExplanation(e.target.value)}
                          className="w-full px-4 py-3 bg-vsoft/40 border border-vsoft-border rounded-2xl text-xs font-bold text-vcharcoal focus:outline-none focus:border-vcoral focus:bg-white transition-all"
                          placeholder="Why did you choose this?"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    disabled={isSubmitting}
                    onClick={handleSubmitAnswer}
                    className="w-full py-4 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold shadow-lg shadow-rose-500/25 text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <span>{isSubmitting ? 'Submitting...' : 'Submit & Connect'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          ) : (
            /* REVEALED RESULTS LOCKED UNTIL ALL 5 QUESTIONS DONE */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-2 text-center"
            >
              <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold shadow-sm">
                  ✓
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-vcharcoal font-display">Prompt #{currentIndex + 1} Saved!</h4>
                  <p className="text-xs text-vgray leading-relaxed font-medium">
                    Both you and <span className="font-bold text-vcharcoal">{profile.partnerName}</span> have submitted responses for this prompt!
                  </p>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-[11px] font-semibold text-emerald-800 flex items-center justify-center space-x-1.5">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Full side-by-side answers & AI scores unlock in the Answer Checker once all 10 prompts are completed.</span>
                </div>
              </div>

              {/* Next Question Controller */}
              <div className="pt-2 space-y-2">
                {currentIndex < dailySession.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="w-full py-3.5 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/20"
                  >
                    <span>Next Prompt ({currentIndex + 2}/10)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="p-4 bg-gradient-to-r from-vcoral to-vpink-start text-white rounded-2xl space-y-1 shadow-md">
                      <span className="text-xs font-extrabold uppercase tracking-wider block">🎉 All 10 Daily Prompts Completed!</span>
                      <p className="text-[11px] text-white/90">Go to the Answer Checker tab to reveal all answers & compatibility scores!</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

    </div>
  );
}
