import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Lock, Sparkles, CheckCircle2, Flame, Award, Heart, RefreshCw, HelpCircle, ArrowRight, ShieldCheck, History, Calendar, Play, Pause, Volume2 } from 'lucide-react';
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
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const toggleVoicePlayback = (url: string) => {
    if (!url) return;
    if (playingAudioUrl === url) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingAudioUrl(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play().catch(e => console.error(e));
      setPlayingAudioUrl(url);
      audio.onended = () => {
        setPlayingAudioUrl(null);
      };
    }
  };

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

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
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
                View today's revealed answers & ratings comparison
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isAllComplete ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
            {completedCount}/{totalCount} Today
          </span>
        </div>

        {/* Today's Progress Bar */}
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
      </div>

      {/* TODAY'S ANSWERS */}
      <>
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
                  To keep the surprise exciting, responses and AI match scores for today remain sealed until <span className="font-bold text-vcharcoal">both you and {profile.partnerName}</span> answer all 10 daily questions!
                </p>
              </div>

              {/* Daily 10 Questions Status Checklist */}
              <div className="bg-vsoft/60 border border-vsoft-border rounded-2xl p-3 space-y-2 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-vgray px-1 block">
                  Today's 10 Questions Status
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
            </div>
          ) : (
            /* UNLOCKED FULL ANSWER CHECKER VIEW (ALL 10 COMPLETED SAME DAY) */
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

                  {/* Visual Comparison Displays for New Formats */}
                  {dailySession.questions[selectedQuestionIndex].type === 'slider' ? (
                    <div className="p-5 bg-vsoft/60 border border-vsoft-border rounded-3xl space-y-4">
                      <span className="text-[10px] font-extrabold uppercase text-vcoral tracking-wider block text-center">Visual Slider Comparison</span>
                      
                      <div className="relative pt-6 pb-2 px-3">
                        {/* Slider track */}
                        <div className="w-full bg-white h-2 rounded-full border border-vborder relative">
                          {/* Span highlight */}
                          <div
                            className="absolute h-full bg-gradient-to-r from-vcoral to-vpink-start rounded-full"
                            style={{
                              left: `${Math.min(parseInt(dailySession.questions[selectedQuestionIndex].userAnswer) || 0, parseInt(dailySession.questions[selectedQuestionIndex].partnerAnswer) || 0)}%`,
                              width: `${Math.abs((parseInt(dailySession.questions[selectedQuestionIndex].userAnswer) || 0) - (parseInt(dailySession.questions[selectedQuestionIndex].partnerAnswer) || 0))}%`
                            }}
                          />
                          
                          {/* User avatar pin */}
                          <div
                            className="absolute -top-6 -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${parseInt(dailySession.questions[selectedQuestionIndex].userAnswer) || 0}%` }}
                          >
                            <span className="text-[9px] font-black text-vcoral bg-white px-2 py-0.5 border border-vcoral rounded-full shadow-sm">
                              You: {dailySession.questions[selectedQuestionIndex].userAnswer || 0}
                            </span>
                            <div className="text-lg">{profile.avatarUrl}</div>
                          </div>
                          
                          {/* Partner avatar pin */}
                          <div
                            className="absolute -top-6 -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${parseInt(dailySession.questions[selectedQuestionIndex].partnerAnswer) || 0}%` }}
                          >
                            <span className="text-[9px] font-black text-emerald-600 bg-white px-2 py-0.5 border border-emerald-300 rounded-full shadow-sm">
                              {profile.partnerName}: {dailySession.questions[selectedQuestionIndex].partnerAnswer || 0}
                            </span>
                            <div className="text-lg">{profile.partnerAvatarUrl || '🌸'}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center pt-2">
                        <span className="text-[11px] font-extrabold text-vcharcoal bg-white border border-vborder px-4 py-1.5 rounded-full shadow-sm">
                          Difference: {Math.abs((parseInt(dailySession.questions[selectedQuestionIndex].userAnswer) || 0) - (parseInt(dailySession.questions[selectedQuestionIndex].partnerAnswer) || 0))} points
                        </span>
                      </div>
                    </div>
                  ) : dailySession.questions[selectedQuestionIndex].type === 'ranking' ? (
                    <div className="grid grid-cols-2 gap-4 bg-vsoft/40 border border-vsoft-border p-4 rounded-3xl relative overflow-hidden">
                      {/* User list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold uppercase text-vcoral block text-center">Your Ranking</span>
                        {dailySession.questions[selectedQuestionIndex].userAnswer.split(',').map((item, idx) => {
                          const partnerIdx = dailySession.questions[selectedQuestionIndex].partnerAnswer.split(',').indexOf(item);
                          const isMatch = partnerIdx === idx;
                          return (
                            <div key={item} className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center space-x-2 shadow-sm ${
                              isMatch ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-vborder text-vcharcoal'
                            }`}>
                              <span className="w-4 h-4 rounded-full bg-vsoft text-[9px] flex items-center justify-center font-black">{idx + 1}</span>
                              <span className="truncate flex-1">{item}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Partner list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600 block text-center">{profile.partnerName}'s Ranking</span>
                        {dailySession.questions[selectedQuestionIndex].partnerAnswer.split(',').map((item, idx) => {
                          const userIdx = dailySession.questions[selectedQuestionIndex].userAnswer.split(',').indexOf(item);
                          const isMatch = userIdx === idx;
                          return (
                            <div key={item} className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center space-x-2 shadow-sm ${
                              isMatch ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-vborder text-vcharcoal'
                            }`}>
                              <span className="w-4 h-4 rounded-full bg-vsoft text-[9px] flex items-center justify-center font-black">{idx + 1}</span>
                              <span className="truncate flex-1">{item}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Side-by-Side Answers Comparison for text, emojis, reaction, predictions */
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
                        
                        {dailySession.questions[selectedQuestionIndex].type === 'voice' ? (
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => toggleVoicePlayback(dailySession.questions[selectedQuestionIndex].userAnswer)}
                              className="px-4 py-2 bg-vcoral text-white rounded-full text-xs font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              {playingAudioUrl === dailySession.questions[selectedQuestionIndex].userAnswer ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                              <span>{playingAudioUrl === dailySession.questions[selectedQuestionIndex].userAnswer ? 'Pause Playback' : 'Play My Answer 🎤'}</span>
                            </button>
                          </div>
                        ) : dailySession.questions[selectedQuestionIndex].type === 'emoji_only' ? (
                          <div className="flex flex-wrap gap-1.5 justify-start py-1">
                            {Array.from(dailySession.questions[selectedQuestionIndex].userAnswer).map((emo, eIdx) => (
                              <motion.span
                                key={eIdx}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-3xl p-1 bg-white border border-vborder rounded-full w-12 h-12 flex items-center justify-center shadow-sm"
                              >
                                {emo}
                              </motion.span>
                            ))}
                          </div>
                        ) : dailySession.questions[selectedQuestionIndex].type === 'reaction_meter' ? (
                          <div className="flex items-center space-x-3.5 py-1">
                            <span className="text-4xl">{dailySession.questions[selectedQuestionIndex].userAnswer.split(' ')[0]}</span>
                            <span className="text-xs font-extrabold text-vcharcoal bg-white border border-vborder px-3 py-1 rounded-full">{dailySession.questions[selectedQuestionIndex].userAnswer.split(' ')[1]}</span>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-vcharcoal leading-relaxed">
                            {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                              ? (dailySession.questions[selectedQuestionIndex].userPrediction
                                ? `"${dailySession.questions[selectedQuestionIndex].userPrediction}"`
                                : 'No prediction recorded')
                              : (dailySession.questions[selectedQuestionIndex].userAnswer
                                ? `"${dailySession.questions[selectedQuestionIndex].userAnswer}"`
                                : 'No selection recorded')}
                          </p>
                        )}
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
                        
                        {dailySession.questions[selectedQuestionIndex].type === 'voice' ? (
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => toggleVoicePlayback(dailySession.questions[selectedQuestionIndex].partnerAnswer)}
                              className="px-4 py-2 bg-vcoral text-white rounded-full text-xs font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              {playingAudioUrl === dailySession.questions[selectedQuestionIndex].partnerAnswer ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                              <span>{playingAudioUrl === dailySession.questions[selectedQuestionIndex].partnerAnswer ? 'Pause Playback' : "Play Partner's Answer 🎤"}</span>
                            </button>
                          </div>
                        ) : dailySession.questions[selectedQuestionIndex].type === 'emoji_only' ? (
                          <div className="flex flex-wrap gap-1.5 justify-start py-1">
                            {Array.from(dailySession.questions[selectedQuestionIndex].partnerAnswer).map((emo, eIdx) => (
                              <motion.span
                                key={eIdx}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-3xl p-1 bg-white border border-vborder rounded-full w-12 h-12 flex items-center justify-center shadow-sm"
                              >
                                {emo}
                              </motion.span>
                            ))}
                          </div>
                        ) : dailySession.questions[selectedQuestionIndex].type === 'reaction_meter' ? (
                          <div className="flex items-center space-x-3.5 py-1">
                            <span className="text-4xl">{dailySession.questions[selectedQuestionIndex].partnerAnswer.split(' ')[0]}</span>
                            <span className="text-xs font-extrabold text-vcharcoal bg-white border border-vborder px-3 py-1 rounded-full">{dailySession.questions[selectedQuestionIndex].partnerAnswer.split(' ')[1]}</span>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-vcharcoal leading-relaxed">
                            {dailySession.questions[selectedQuestionIndex].type === 'prediction'
                              ? (dailySession.questions[selectedQuestionIndex].partnerPrediction
                                ? `"${dailySession.questions[selectedQuestionIndex].partnerPrediction}"`
                                : 'No prediction recorded')
                              : (dailySession.questions[selectedQuestionIndex].partnerAnswer
                                ? `"${dailySession.questions[selectedQuestionIndex].partnerAnswer}"`
                                : 'No selection recorded')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

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
      </>
    </div>
  );
}
