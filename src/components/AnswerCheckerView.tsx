import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Sparkles, CheckCircle2, Flame, Award, Heart, RefreshCw, HelpCircle, ArrowRight, ShieldCheck, History, Calendar } from 'lucide-react';
import { Profile, DailySession, Memory } from '../types';
import confetti from 'canvas-confetti';

interface AnswerCheckerViewProps {
  profile: Profile;
  dailySession: DailySession | null;
  memories?: Memory[];
  onUpdateSession: (updatedSession: DailySession) => void;
}

export default function AnswerCheckerView({
  profile,
  dailySession,
  memories = [],
  onUpdateSession
}: AnswerCheckerViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'today' | 'history'>('today');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  if (!dailySession) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-vborder shadow-sm space-y-3">
        <HelpCircle className="w-10 h-10 text-vcoral mx-auto" />
        <h3 className="font-bold text-vcharcoal text-sm">No Active Session</h3>
        <p className="text-xs text-vgray">Daily session is loading...</p>
      </div>
    );
  }

  const completedQuestions = dailySession.questions.filter(q => q.answeredByUser && q.answeredByPartner);
  const completedCount = completedQuestions.length;
  const totalCount = dailySession.questions.length;
  const isAllComplete = completedCount >= totalCount;

  // Filter memories from previous days (or previous sessions)
  const allHistoryMemories = memories.length > 0 ? memories : [];

  return (
    <div className="space-y-5">
      
      {/* Header Banner & Sub-Tab Switcher */}
      <div className="bg-white border border-vborder rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-vcoral flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-vcharcoal font-display leading-tight">
                Answer Checker
              </h2>
              <p className="text-[11px] text-vgray font-medium">
                View today's revealed answers & previous day history
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isAllComplete ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
            {completedCount}/{totalCount} Today
          </span>
        </div>

        {/* Sub-Tab Navigation Pills: Today's Answers | Previous Day Answers */}
        <div className="grid grid-cols-2 gap-2 bg-vsoft/60 p-1 rounded-2xl border border-vsoft-border text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('today')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'today'
                ? 'bg-white text-vcoral shadow-sm border border-vborder'
                : 'text-vgray hover:text-vcharcoal'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-vcoral" />
            <span>Today's Answers</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-white text-vcoral shadow-sm border border-vborder'
                : 'text-vgray hover:text-vcharcoal'
            }`}
          >
            <History className="w-3.5 h-3.5 text-vcoral" />
            <span>Previous Answers ({allHistoryMemories.length})</span>
          </button>
        </div>

        {/* Today's Progress Bar (Only visible on Today tab) */}
        {activeSubTab === 'today' && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-bold text-vgray">
              <span>Progress to Answer Reveal</span>
              <span className="text-vcoral">{Math.round((completedCount / totalCount) * 100)}%</span>
            </div>
            <div className="w-full bg-vsoft h-2.5 rounded-full overflow-hidden border border-vsoft-border">
              <div 
                className="bg-gradient-to-r from-vcoral to-vpink-start h-full transition-all duration-500 rounded-full"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: TODAY'S ANSWERS */}
      {activeSubTab === 'today' && (
        <>
          {/* LOCKED STATE CARD (When less than 5 questions completed today) */}
          {!isAllComplete ? (
            <div className="bg-white border border-vborder rounded-[32px] p-6 text-center space-y-5 shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-vsoft border border-vsoft-border text-vcoral flex items-center justify-center mx-auto shadow-inner text-2xl">
                🔒
              </div>

              <div className="space-y-2 max-w-xs mx-auto">
                <h3 className="text-base font-extrabold text-vcharcoal font-display">
                  Today's Answers Locked
                </h3>
                <p className="text-xs text-vgray leading-relaxed font-medium">
                  To keep the surprise exciting, responses and AI match scores for today remain sealed until <span className="font-bold text-vcharcoal">both you and {profile.partnerName}</span> answer all 5 daily questions!
                </p>
              </div>

              {/* Daily 5 Questions Status Checklist */}
              <div className="bg-vsoft/60 border border-vsoft-border rounded-2xl p-3 space-y-2 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-vgray px-1 block">
                  Today's 5 Questions Status
                </span>
                {dailySession.questions.map((q, idx) => {
                  const bothDone = q.answeredByUser && q.answeredByPartner;
                  const userDone = q.answeredByUser;
                  const partnerDone = q.answeredByPartner;

                  return (
                    <div key={q.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-vsoft-border text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-vsoft flex items-center justify-center text-[10px] font-bold text-vcoral shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-vcharcoal truncate">{q.text}</span>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                        bothDone 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : userDone 
                          ? 'bg-blue-50 text-blue-600'
                          : partnerDone
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {bothDone ? '✓ Both Done' : userDone ? 'Waiting Partner' : partnerDone ? `${profile.partnerName} Done` : 'Locked'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Shortcut to Previous Day Answers */}
              {allHistoryMemories.length > 0 && (
                <button
                  onClick={() => setActiveSubTab('history')}
                  className="w-full py-3 bg-vsoft border border-vsoft-border rounded-2xl text-xs font-bold text-vcoral hover:bg-vsoft/80 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>View Previous Day Answers ({allHistoryMemories.length}) →</span>
                </button>
              )}
            </div>
          ) : (
            /* UNLOCKED FULL ANSWER CHECKER VIEW (ALL 5 COMPLETED SAME DAY) */
            <div className="space-y-5">
              
              {/* Overall Compatibility Summary Card */}
              <div className="bg-gradient-to-br from-[#FF466E] to-[#FF758F] text-white rounded-[32px] p-6 shadow-xl shadow-rose-500/20 space-y-4 text-center relative overflow-hidden">
                <span className="inline-flex items-center space-x-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Today's Complete Reveal</span>
                </span>

                <div className="space-y-1">
                  <div className="text-5xl font-black font-display tracking-tight">
                    {dailySession.compatibilityScore || 90}%
                  </div>
                  <div className="text-xs font-bold text-white/90 uppercase tracking-widest">
                    Overall Compatibility Score
                  </div>
                </div>

                <p className="text-xs text-white/95 leading-relaxed font-medium max-w-sm mx-auto bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
                  "{dailySession.aiSummary || `You and ${profile.partnerName} completed all 5 daily questions! You share a wonderful bond.`}"
                </p>
              </div>

              {/* Question Selector Pills */}
              <div className="flex space-x-1.5 overflow-x-auto py-1 scrollbar-none">
                {dailySession.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestionIndex(idx)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all shrink-0 flex items-center space-x-1.5 cursor-pointer ${
                      selectedQuestionIndex === idx
                        ? 'bg-vcoral text-white shadow-md shadow-rose-500/20 scale-105'
                        : 'bg-white text-vcharcoal border border-vborder hover:bg-vsoft'
                    }`}
                  >
                    <span>Prompt #{idx + 1}</span>
                    <span className="text-[10px] opacity-80">({q.similarityScore || 85}%)</span>
                  </button>
                ))}
              </div>

              {/* Active Question Answer Comparison Card */}
              {dailySession.questions[selectedQuestionIndex] && (
                <motion.div
                  key={dailySession.questions[selectedQuestionIndex].id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-vborder rounded-[32px] p-6 space-y-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-vsoft text-vcoral border border-vsoft-border rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                      {dailySession.questions[selectedQuestionIndex].category} • {dailySession.questions[selectedQuestionIndex].type === 'multiple_choice' ? 'Choice Match 🎯' : dailySession.questions[selectedQuestionIndex].type === 'prediction' ? 'Prediction Challenge 🎯' : 'Reflection'}
                    </span>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                      dailySession.questions[selectedQuestionIndex].type === 'multiple_choice'
                        ? (dailySession.questions[selectedQuestionIndex].userAnswer === dailySession.questions[selectedQuestionIndex].partnerAnswer
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-amber-600 bg-amber-50 border-amber-200')
                        : ((dailySession.questions[selectedQuestionIndex].similarityScore || 85) >= 80
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-amber-600 bg-amber-50 border-amber-200')
                    }`}>
                      {dailySession.questions[selectedQuestionIndex].type === 'multiple_choice'
                        ? (dailySession.questions[selectedQuestionIndex].userAnswer === dailySession.questions[selectedQuestionIndex].partnerAnswer ? '🎉 Same Choice!' : '💡 Different Choices')
                        : `Match: ${dailySession.questions[selectedQuestionIndex].similarityScore || 88}%`}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-vcharcoal font-display leading-snug">
                    {dailySession.questions[selectedQuestionIndex].text}
                  </h3>

                  {/* Side-by-Side Answers Comparison */}
                  <div className="space-y-3">
                    {/* User Answer */}
                    <div className="p-4 bg-vsoft/70 border border-vsoft-border rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-vcoral">
                        <span>
                          {profile.name}{' '}
                          {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                            ? '(Your Prediction)'
                            : '(Your Choice)'}
                        </span>
                        <span>{profile.avatarUrl}</span>
                      </div>
                      <p className="text-xs font-bold text-vcharcoal leading-relaxed">
                        {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                          ? (dailySession.questions[selectedQuestionIndex].userPrediction
                            ? `"${dailySession.questions[selectedQuestionIndex].userPrediction}"`
                            : 'No prediction recorded')
                          : (dailySession.questions[selectedQuestionIndex].userAnswer
                            ? `"${dailySession.questions[selectedQuestionIndex].userAnswer}"`
                            : 'No selection recorded')}
                      </p>
                    </div>

                    {/* Partner Answer */}
                    <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-vcoral">
                        <span>
                          {profile.partnerName}{' '}
                          {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                            ? '(Their Prediction)'
                            : dailySession.questions[selectedQuestionIndex].userAnswer ===
                              dailySession.questions[selectedQuestionIndex].partnerAnswer
                            ? '(Matched Choice ✨)'
                            : '(Their Choice)'}
                        </span>
                        <span>{profile.partnerAvatarUrl || '🌸'}</span>
                      </div>
                      <p className="text-xs font-bold text-vcharcoal leading-relaxed">
                        {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                          ? (dailySession.questions[selectedQuestionIndex].partnerPrediction
                            ? `"${dailySession.questions[selectedQuestionIndex].partnerPrediction}"`
                            : 'No prediction recorded')
                          : (dailySession.questions[selectedQuestionIndex].partnerAnswer
                            ? `"${dailySession.questions[selectedQuestionIndex].partnerAnswer}"`
                            : 'No selection recorded')}
                      </p>
                    </div>
                  </div>

                  {/* Gemini AI Commentary */}
                  {dailySession.questions[selectedQuestionIndex].aiCommentary && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/70 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-1.5 text-xs font-extrabold text-purple-700">
                        <Sparkles className="w-4 h-4 fill-purple-400 text-purple-600" />
                        <span>Choice Match Insight</span>
                      </div>
                      <p className="text-xs text-purple-900 leading-relaxed font-medium italic">
                        "{dailySession.questions[selectedQuestionIndex].aiCommentary}"
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

            </div>
          )}
        </>
      )}

      {/* SUB-TAB 2: PREVIOUS DAY ANSWERS HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {allHistoryMemories.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-vborder shadow-sm space-y-3">
              <Calendar className="w-10 h-10 text-vcoral/60 mx-auto" />
              <h3 className="font-bold text-vcharcoal text-sm">No Previous Day Answers Yet</h3>
              <p className="text-xs text-vgray leading-relaxed max-w-xs mx-auto">
                Completed questions automatically archive here when the day rolls over. Keep answering daily prompts together!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-vgray">
                  Previous Completed Answers
                </span>
                <span className="text-xs font-bold text-vcoral">
                  {allHistoryMemories.length} Prompts Saved
                </span>
              </div>

              {allHistoryMemories.map((mem) => (
                <motion.div
                  key={mem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-vborder rounded-3xl p-5 space-y-4 shadow-sm"
                >
                  {/* Header Tag & Date */}
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-vsoft text-vcoral border border-vsoft-border rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                      {mem.category}
                    </span>
                    <span className="text-[10px] font-bold text-vgray flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-vcoral" />
                      <span>{mem.date}</span>
                    </span>
                  </div>

                  {/* Question Text */}
                  <h4 className="text-sm font-extrabold text-vcharcoal font-display leading-snug">
                    {mem.questionText}
                  </h4>

                  {/* Side-by-Side Completed Answers */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* User Answer */}
                    <div className="p-3.5 bg-vsoft/60 border border-vsoft-border rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-vcoral">
                        <span>{profile.name}</span>
                        <span>{profile.avatarUrl}</span>
                      </div>
                      <p className="text-xs font-bold text-vcharcoal">
                        "{mem.userAnswer}"
                      </p>
                    </div>

                    {/* Partner Answer */}
                    <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-vcoral">
                        <span>{profile.partnerName}</span>
                        <span>{profile.partnerAvatarUrl || '🌸'}</span>
                      </div>
                      <p className="text-xs font-bold text-vcharcoal">
                        "{mem.partnerAnswer}"
                      </p>
                    </div>
                  </div>

                  {/* Match Score & AI Commentary */}
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/70 rounded-2xl flex items-start space-x-2 text-xs">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-purple-900">
                          Similarity: {mem.similarityScore}%
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-900/90 font-medium italic">
                        "{mem.aiCommentary}"
                      </p>
                    </div>
                  </div>

                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
