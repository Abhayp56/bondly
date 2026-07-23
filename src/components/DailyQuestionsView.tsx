import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Sparkles, CheckCircle2, ChevronRight, HelpCircle, 
  RefreshCw, Award, ArrowRight, Heart, Flame, ShieldAlert, Zap, Clock
} from 'lucide-react';
import { Profile, DailyQuestion, DailySession, Memory } from '../types';
import confetti from 'canvas-confetti';
import { getApiUrl } from '../config';

interface DailyQuestionsProps {
  profile: Profile;
  dailySession: DailySession | null;
  onUpdateSession: (updatedSession: DailySession) => void;
  onAddMemory: (memory: Memory) => void;
}

const SCHEDULE_LABELS = [
  'Morning (8:00 AM) ☀️',
  'Afternoon (12:00 PM) 🌤️',
  'Evening (4:00 PM) 🌅',
  'Night (8:00 PM) 🌙',
  'Late Night (10:00 PM) 🌌'
];

export default function DailyQuestionsView({ 
  profile, 
  dailySession, 
  onUpdateSession, 
  onAddMemory 
}: DailyQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [userExplanation, setUserExplanation] = useState('');
  const [userPrediction, setUserPrediction] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [errMsg, setErrMsg] = useState('');



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
    }
  }, [currentIndex]);

  if (!dailySession || !activeQuestion) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-vborder shadow-sm space-y-3">
        <ShieldAlert className="w-10 h-10 text-vcoral mx-auto" />
        <h3 className="font-bold text-vcharcoal text-sm">No active daily session</h3>
        <p className="text-xs text-vgray">Session is loading or initializing...</p>
      </div>
    );
  }

  // Helper to reliably compute local scheduled unlock time for target slot hours (8 AM, 12 PM, 4 PM, 8 PM, 10 PM)
  const getQuestionUnlockDate = (qUnlockTime: string, idx: number): Date => {
    const hours = [8, 12, 16, 20, 22];
    const targetHour = hours[idx] !== undefined ? hours[idx] : 8 + idx * 3;
    const now = new Date();

    if (!qUnlockTime) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, 0, 0);
    }

    // If formatted ISO string without Z, JavaScript parses as local time
    if (!qUnlockTime.endsWith('Z') && qUnlockTime.includes('T')) {
      const parsed = new Date(qUnlockTime);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Fallback/Legacy UTC string normalization to local time today
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, 0, 0);
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

    setIsSubmitting(true);
    setErrMsg('');
    try {
      if (profile.roomCode) {
        // Submit answer to real-time room backend
        const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}/answer`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: profile.slot || 'user1',
            questionIndex: currentIndex,
            answer: userAnswer,
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
          updatedQuestion.userAnswer = userAnswer;
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
              userAnswer: userAnswer,
              partnerAnswer: 'Simulated AI Answer',
              userPrediction: userPrediction,
              partnerPrediction: ''
            })
          });

          if (response.ok) {
            const aiResult = await response.json();
            let partnerAns = "I think we'd have a wonderful cottage in the quiet hills with a small reading nook.";
            if (activeQuestion.category === 'Fun') partnerAns = "I would definitely try to lock us inside a huge store with infinite snacks!";
            if (activeQuestion.category === 'Friendship') partnerAns = "Your empathy and ability to always listen without judgment.";

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

          const newMemory: Memory = {
            id: `mem_${Date.now()}`,
            date: dailySession.date,
            questionText: updatedQuestion.text,
            category: updatedQuestion.category,
            userAnswer: updatedQuestion.type === 'prediction' ? `Prediction: ${updatedQuestion.userPrediction}` : updatedQuestion.userAnswer,
            partnerAnswer: updatedQuestion.partnerAnswer,
            similarityScore: updatedQuestion.similarityScore || 85,
            aiCommentary: updatedQuestion.aiCommentary || 'Incredible synchrony!',
          };
          onAddMemory(newMemory);
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
                      "{activeQuestion.type === 'prediction' ? activeQuestion.userPrediction : activeQuestion.userAnswer}"
                    </p>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] font-bold text-amber-800 flex items-center justify-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Waiting for {profile.partnerName} to submit her response...</span>
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
                  <span>Full side-by-side answers & AI scores unlock in the Answer Checker once all 5 prompts are completed.</span>
                </div>
              </div>

              {/* Next Question Controller */}
              <div className="pt-2 space-y-2">
                {currentIndex < dailySession.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="w-full py-3.5 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/20"
                  >
                    <span>Next Prompt ({currentIndex + 2}/5)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="p-4 bg-gradient-to-r from-vcoral to-vpink-start text-white rounded-2xl space-y-1 shadow-md">
                      <span className="text-xs font-extrabold uppercase tracking-wider block">🎉 All 5 Daily Prompts Completed!</span>
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
