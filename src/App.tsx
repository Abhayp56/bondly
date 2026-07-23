import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Sparkles, Flame, Users, Calendar, BarChart3, 
  Gamepad2, Award, User, Bell, Clock, ShieldCheck, BellRing, CheckCircle2
} from 'lucide-react';
import { Profile, DailySession, Memory, FriendshipTimelineEvent, Achievement, DailyQuestion } from './types';
import { DEFAULT_QUESTIONS, INITIAL_ACHIEVEMENTS, INITIAL_TIMELINE_EVENTS } from './data';
import { requestAppNotificationPermission, sendAppNotification, syncDailyQuestionNotifications } from './services/notificationService';
import { supabase } from './lib/supabaseClient';
import { getApiUrl } from './config';

import Onboarding from './components/Onboarding';
import DailyQuestionsView from './components/DailyQuestionsView';
import AnswerCheckerView from './components/AnswerCheckerView';
import InsightsView from './components/InsightsView';
import MiniGamesView from './components/MiniGamesView';
import AchievementsView from './components/AchievementsView';

const DEFAULT_MEMORIES: Memory[] = [];

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dailySession, setDailySession] = useState<DailySession | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<FriendshipTimelineEvent[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  const [activeTab, setActiveTab] = useState<'home' | 'questions' | 'checker' | 'insights' | 'games' | 'profile'>('home');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false);

  // Track notified question events to avoid duplicate alerts
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  // Seed past unlock keys on session load so opening the app doesn't trigger bulk past alerts
  useEffect(() => {
    if (!dailySession) return;
    const now = new Date();
    dailySession.questions.forEach(q => {
      const unlockDate = new Date(q.unlockTime);
      if (unlockDate <= now) {
        notifiedEventsRef.current.add(`unlock_${dailySession.id}_${q.id}`);
      }
    });
    // Sync scheduled native notifications ONLY for future unanswered prompts
    syncDailyQuestionNotifications(dailySession.questions);
  }, [dailySession?.id]);

  // Helper to trigger Native OS Status Bar & In-app notifications
  const sendAlert = (title: string, body: string) => {
    // 1. In-app banner
    setNotifications(prev => [body, ...prev.slice(0, 4)]);

    // 2. Native Mobile Status Bar / Desktop notification
    sendAppNotification(title, body);
  };

  // Request Native OS notification permissions on mount
  useEffect(() => {
    requestAppNotificationPermission().then(granted => {
      setHasNotificationPermission(granted);
    });
  }, []);

  // Request browser notification permission
  const handleRequestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Browser notifications are not supported in this environment.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setHasNotificationPermission(true);
        sendAlert('🔔 Notifications Activated!', 'You will now receive instant desktop notifications when new questions unlock or when your partner answers!');
      } else {
        alert('Notification permission was denied. You can enable it in your browser site settings.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setHasNotificationPermission(true);
    }
  }, []);

  // Periodic Notification Scanner (runs every 3s to detect unlock times & partner activity)
  useEffect(() => {
    if (!dailySession || !profile) return;

    const checkNotifications = () => {
      const now = new Date();
      dailySession.questions.forEach((q, idx) => {
        const unlockDate = new Date(q.unlockTime);
        const isUnlocked = unlockDate <= now;
        const qNum = idx + 1;

        // Event 1: Question unlock time reached!
        const unlockKey = `unlock_${dailySession.id}_${q.id}`;
        if (isUnlocked && !notifiedEventsRef.current.has(unlockKey)) {
          notifiedEventsRef.current.add(unlockKey);
          sendAlert(
            `🔔 Question #${qNum} Unlocked!`,
            `Question #${qNum} (${q.category}) is now unlocked! Time for you and ${profile.partnerName} to share your thoughts.`
          );
        }

        // Event 2: Partner answered a question!
        const partnerAnsKey = `partner_ans_${dailySession.id}_${q.id}`;
        if (q.answeredByPartner && !notifiedEventsRef.current.has(partnerAnsKey)) {
          notifiedEventsRef.current.add(partnerAnsKey);
          sendAlert(
            `💖 ${profile.partnerName} Answered!`,
            `${profile.partnerName} has submitted an answer for Question #${qNum}! Open Daily Questions to reveal responses.`
          );
        }

        // Event 3: Both answered (Match ready!)
        const bothDoneKey = `both_done_${dailySession.id}_${q.id}`;
        if (q.answeredByUser && q.answeredByPartner && !notifiedEventsRef.current.has(bothDoneKey)) {
          notifiedEventsRef.current.add(bothDoneKey);
          sendAlert(
            `🎉 Compatibility Calculated!`,
            `You and ${profile.partnerName} both completed Question #${qNum}! View your AI compatibility score.`
          );
        }
      });
    };

    checkNotifications();
    const timer = setInterval(checkNotifications, 3000);
    return () => clearInterval(timer);
  }, [dailySession, profile]);

  // Load state from local storage
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem('bondly_profile');
      const storedSession = localStorage.getItem('bondly_daily_session');
      const storedMemories = localStorage.getItem('bondly_memories');
      const storedTimeline = localStorage.getItem('bondly_timeline');
      const storedAchievements = localStorage.getItem('bondly_achievements');

      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      }
      
      let sessionObj: DailySession | null = null;
      const todayStr = new Date().toISOString().split('T')[0];
      let loadedMemories: Memory[] = [];

      if (storedMemories) {
        try {
          loadedMemories = JSON.parse(storedMemories);
        } catch (e) {
          console.warn('Failed to parse memories:', e);
        }
      }

      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession) as DailySession;
          if (parsed) {
            if (parsed.date === todayStr) {
              sessionObj = parsed;
            } else {
              // Rollover: Archive answered questions from previous session client-side
              const archivedList = [...loadedMemories];
              let modified = false;
              parsed.questions.forEach(q => {
                const user1Responded = q.answeredByUser;
                const user2Responded = q.answeredByPartner;
                if (user1Responded || user2Responded) {
                  const alreadyArchived = archivedList.some(
                    m => m.questionText === q.text && m.date === parsed.date
                  );
                  if (!alreadyArchived) {
                    archivedList.unshift({
                      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      date: parsed.date,
                      questionText: q.text,
                      category: q.category,
                      userAnswer: q.type === 'prediction' ? (q.userPrediction || '') : (q.userAnswer || ''),
                      partnerAnswer: q.partnerAnswer || '',
                      similarityScore: q.similarityScore || 85,
                      aiCommentary: q.aiCommentary || 'Shared wonderful thoughts reflecting your connection.',
                    });
                    modified = true;
                  }
                }
              });
              if (modified) {
                loadedMemories = archivedList;
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse stored session:', e);
        }
      }

      // Memory Cleanup: purge memories older than 2 days client-side
      const todayDateObj = new Date(todayStr);
      loadedMemories = loadedMemories.filter(mem => {
        const memDateObj = new Date(mem.date);
        if (isNaN(memDateObj.getTime())) return true;
        const diffTime = todayDateObj.getTime() - memDateObj.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays <= 2; // Keep if <= 2 days old (removes after the day after tomorrow)
      });

      setMemories(loadedMemories);
      localStorage.setItem('bondly_memories', JSON.stringify(loadedMemories));

      if (sessionObj) {
        setDailySession(sessionObj);
      } else {
        const hours = [8, 12, 16, 20, 22];
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        const bypassLock = import.meta.env.VITE_BYPASS_TIME_LOCK === 'true';
        const sessionQs: DailyQuestion[] = DEFAULT_QUESTIONS.slice(0, 5).map((q, idx) => {
          let unlockTimeStr: string;
          if (bypassLock) {
            const pastDate = new Date(Date.now() - 60000);
            const hourStr = String(pastDate.getHours()).padStart(2, '0');
            const minStr = String(pastDate.getMinutes()).padStart(2, '0');
            const secStr = String(pastDate.getSeconds()).padStart(2, '0');
            unlockTimeStr = `${year}-${month}-${day}T${hourStr}:${minStr}:${secStr}`;
          } else {
            const selectedHour = hours[idx] !== undefined ? hours[idx] : 8 + idx * 3;
            const hourStr = String(selectedHour).padStart(2, '0');
            unlockTimeStr = `${year}-${month}-${day}T${hourStr}:00:00`;
          }
          return {
            id: `dq_${q.id}`,
            questionId: q.id,
            text: q.text,
            category: q.category,
            type: q.type,
            difficulty: q.difficulty,
            answeredByUser: false,
            answeredByPartner: false,
            userAnswer: '',
            partnerAnswer: '',
            unlockTime: unlockTimeStr
          };
        });

        const newSession: DailySession = {
          id: `sess_${todayStr}`,
          date: todayStr,
          questions: sessionQs,
        };
        setDailySession(newSession);
        localStorage.setItem('bondly_daily_session', JSON.stringify(newSession));
      }

      if (storedTimeline) {
        setTimelineEvents(JSON.parse(storedTimeline));
      } else {
        setTimelineEvents(INITIAL_TIMELINE_EVENTS);
        localStorage.setItem('bondly_timeline', JSON.stringify(INITIAL_TIMELINE_EVENTS));
      }

      if (storedAchievements) {
        setAchievements(JSON.parse(storedAchievements));
      } else {
        setAchievements(INITIAL_ACHIEVEMENTS);
        localStorage.setItem('bondly_achievements', JSON.stringify(INITIAL_ACHIEVEMENTS));
      }
    } catch (e) {
      console.error('Failed to load local storage data:', e);
    }
  }, []);

  // Sync Room State from Server
  useEffect(() => {
    if (!profile || !profile.roomCode) return;

    const fetchRoomState = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}?slot=${profile.slot || 'user1'}`));
        if (res.ok) {
          const data = await res.json();
          if (data.roomState) {
            if (data.roomState.dailySession) {
              setDailySession(data.roomState.dailySession);
              localStorage.setItem('bondly_daily_session', JSON.stringify(data.roomState.dailySession));
            }
            if (data.roomState.memories) {
              setMemories(data.roomState.memories);
              localStorage.setItem('bondly_memories', JSON.stringify(data.roomState.memories));
            }
            if (data.roomState.timeline) {
              setTimelineEvents(data.roomState.timeline);
              localStorage.setItem('bondly_timeline', JSON.stringify(data.roomState.timeline));
            }
            if (data.roomState.profile) {
              const serverProfile = data.roomState.profile;
              if (
                profile.streakCount !== serverProfile.streakCount ||
                profile.connected !== serverProfile.connected ||
                profile.partnerName !== serverProfile.partnerName
              ) {
                const mergedProfile = { ...profile, ...serverProfile };
                setProfile(mergedProfile);
                localStorage.setItem('bondly_profile', JSON.stringify(mergedProfile));
              }
            }
          }
        }
      } catch (e) {
        console.warn('Sync room state error:', e);
      }
    };

    // 1. Supabase Realtime WebSocket Listener (Instant Sync)
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel(`room_${profile.roomCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${profile.roomCode}` },
          () => fetchRoomState()
        )
        .subscribe();
    }

    // 2. High-speed HTTP Fallback Polling
    fetchRoomState(); // Run immediately
    const pollInterval = setInterval(fetchRoomState, 4000);

    return () => {
      clearInterval(pollInterval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [profile?.roomCode, profile?.slot, profile?.streakCount, profile?.connected, profile?.partnerName]);

  // AI Companion mode rollover / completion logic
  useEffect(() => {
    if (!profile || profile.roomCode || !dailySession) return;

    const allCompleted = dailySession.questions.every(q => q.answeredByUser && q.answeredByPartner);
    if (allCompleted && !dailySession.compatibilityScore) {
      const getSummary = async () => {
        try {
          const res = await fetch(getApiUrl('/api/ai/session-summary'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: dailySession.questions })
          });
          if (res.ok) {
            const summaryData = await res.json();
            
            // 1. Update dailySession
            const finalSession: DailySession = {
              ...dailySession,
              compatibilityScore: summaryData.compatibilityScore,
              breakdown: summaryData.breakdown,
              aiSummary: summaryData.aiSummary,
              completedAt: new Date().toISOString()
            };
            setDailySession(finalSession);
            localStorage.setItem('bondly_daily_session', JSON.stringify(finalSession));

            // 2. Increment streak in profile
            const updatedProfile = {
              ...profile,
              streakCount: (profile.streakCount || 0) + 1
            };
            setProfile(updatedProfile);
            localStorage.setItem('bondly_profile', JSON.stringify(updatedProfile));

            // 3. Add timeline event
            const completedDate = new Date().toISOString().split('T')[0];
            const newTimelineEvent = {
              id: `evt_completed_${Date.now()}`,
              title: 'Daily Prompts Completed! 🎉',
              description: `Completed all 5 daily prompts with a bond score of ${summaryData.compatibilityScore}%!`,
              date: completedDate,
              type: 'milestone',
              icon: '💖'
            };
            const updatedTimeline = [newTimelineEvent, ...timelineEvents];
            setTimelineEvents(updatedTimeline);
            localStorage.setItem('bondly_timeline', JSON.stringify(updatedTimeline));
          }
        } catch (e) {
          console.warn('AI summary fetch failed:', e);
        }
      };
      getSummary();
    }
  }, [dailySession, profile, timelineEvents]);

  // Unlock achievements automatically based on current progress
  useEffect(() => {
    if (!profile) return;

    let achievementsChanged = false;
    const updatedAchievements = achievements.map(ach => {
      if (ach.earned) return ach;

      let earned = false;
      if (ach.id === 'ach_streak_7' && profile.streakCount >= 7) {
        earned = true;
      } else if (ach.id === 'ach_streak_30' && profile.streakCount >= 30) {
        earned = true;
      } else if (ach.id === 'ach_q_100' && memories.length >= 100) {
        earned = true;
      } else if (ach.id === 'ach_soul_sync' && dailySession?.compatibilityScore && dailySession.compatibilityScore >= 95) {
        earned = true;
      } else if (ach.id === 'ach_perfect_pred') {
        const hasPerfect = dailySession?.questions.some(q => q.similarityScore && q.similarityScore >= 95 && q.type === 'prediction') ||
                           memories.some(m => m.similarityScore >= 95 && m.userAnswer.startsWith('Prediction:'));
        if (hasPerfect) earned = true;
      }

      if (earned) {
        achievementsChanged = true;
        return { ...ach, earned: true };
      }
      return ach;
    });

    if (achievementsChanged) {
      setAchievements(updatedAchievements);
      localStorage.setItem('bondly_achievements', JSON.stringify(updatedAchievements));
    }
  }, [profile?.streakCount, dailySession?.compatibilityScore, memories?.length, achievements]);

  const handleUpdateSession = (updatedSession: DailySession) => {
    setDailySession(updatedSession);
    localStorage.setItem('bondly_daily_session', JSON.stringify(updatedSession));
  };

  const handleAddMemory = (newMemory: Memory) => {
    const updated = [newMemory, ...memories];
    setMemories(updated);
    localStorage.setItem('bondly_memories', JSON.stringify(updated));
  };

  const handleCompleteOnboarding = (newProfile: Profile, roomState?: any) => {
    setProfile(newProfile);
    localStorage.setItem('bondly_profile', JSON.stringify(newProfile));
    
    if (roomState && roomState.dailySession) {
      setDailySession(roomState.dailySession);
      localStorage.setItem('bondly_daily_session', JSON.stringify(roomState.dailySession));
    }
    if (roomState && roomState.memories) {
      setMemories(roomState.memories);
      localStorage.setItem('bondly_memories', JSON.stringify(roomState.memories));
    }
    
    setNotifications([
      `🎉 Connected room code: ${newProfile.roomCode || newProfile.friendCode}!`,
      `🔥 Today's daily questions are ready for both of you!`,
    ]);
  };

  const completedCount = dailySession?.questions.filter(q => q.answeredByUser && q.answeredByPartner).length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF5F7] via-[#FAF7F8] to-[#FFF0F3] text-vtext flex items-center justify-center p-0 sm:p-4 font-sans">
      
      {/* Mobile Shell Wrapper */}
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[844px] sm:h-[880px] bg-white sm:rounded-[48px] sm:shadow-2xl sm:shadow-pink-950/10 border-0 sm:border-8 sm:border-white flex flex-col relative overflow-hidden">
        
        {/* Top Status Header */}
        <header className="bg-white/90 backdrop-blur-md px-5 py-3.5 border-b border-vsoft flex items-center justify-between sticky top-0 z-30">
          <div 
            onClick={() => profile && setActiveTab('home')}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-vcoral to-vpink-start flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Heart className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-vcharcoal font-display block leading-none">
                Bondly
              </span>
              {profile && (
                <span className="text-[10px] text-vgray font-medium mt-0.5 block">
                  {profile.roomCode ? `Pair Code: ${profile.roomCode}` : `Connected with ${profile.partnerName}`}
                </span>
              )}
            </div>
          </div>

          {profile && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRequestNotificationPermission}
                title={hasNotificationPermission ? "Desktop Notifications Active 🔔" : "Enable Desktop Question Alerts 🔔"}
                className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                  hasNotificationPermission
                    ? 'bg-rose-50 border-rose-200 text-vcoral'
                    : 'bg-vsoft border-vborder text-vgray hover:text-vcoral'
                }`}
              >
                <BellRing className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-1 px-2.5 py-1 bg-vsoft border border-vsoft-border rounded-full">
                <span className="text-xs">{profile.avatarUrl}</span>
                <span className="text-[11px] font-bold text-vcoral">{profile.name}</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-24">
          {!profile ? (
            <Onboarding onComplete={handleCompleteOnboarding} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5"
              >
                {/* Notification Banner */}
                {notifications.length > 0 && (
                  <div className="bg-[#FFF0F3] border border-[#FFD6DF] rounded-2xl p-3 flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2">
                      <Bell className="w-4 h-4 text-vcoral mt-0.5 shrink-0" />
                      <div className="text-xs text-vcharcoal font-medium leading-snug">
                        {notifications[0]}
                      </div>
                    </div>
                    <button 
                      onClick={() => setNotifications([])}
                      className="text-[10px] text-vcoral font-bold hover:underline shrink-0 uppercase tracking-wider"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* HOME DASHBOARD */}
                {activeTab === 'home' && (
                  <div className="space-y-5">
                    
                    {/* Hero Card */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#FF466E] to-[#FF758F] text-white rounded-[32px] p-6 shadow-xl shadow-rose-500/20 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase">
                          <Flame className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          <span>{profile.streakCount} Day Streak</span>
                        </span>
                        <span className="text-[11px] bg-black/10 px-2.5 py-1 rounded-full font-bold">
                          {completedCount}/5 Questions Done
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold font-display leading-tight">
                          Daily Connection
                        </h2>
                        <p className="text-xs text-white/90 leading-relaxed font-medium">
                          Answer today's 5 prompts together to unlock live similarity scores & AI insights!
                        </p>
                      </div>

                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={() => setActiveTab('questions')}
                          className="bg-white text-vcoral hover:bg-white/95 px-5 py-3 rounded-2xl text-xs font-extrabold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <span>Open Today's Prompts</span>
                          <Sparkles className="w-4 h-4 fill-vcoral" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => setActiveTab('checker')}
                        className="bg-white border border-vborder p-4 rounded-3xl space-y-2 cursor-pointer hover:border-vcoral/30 transition-all shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                          🔍
                        </div>
                        <div>
                          <div className="text-xl font-black text-vcharcoal font-display">{completedCount}/5</div>
                          <div className="text-[11px] font-bold text-vgray">Answer Checker</div>
                        </div>
                      </div>

                      <div 
                        onClick={() => setActiveTab('insights')}
                        className="bg-white border border-vborder p-4 rounded-3xl space-y-2 cursor-pointer hover:border-vcoral/30 transition-all shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-2xl bg-rose-50 text-vcoral flex items-center justify-center font-bold">
                          📊
                        </div>
                        <div>
                          <div className="text-xl font-black text-vcharcoal font-display">
                            {dailySession?.compatibilityScore ? `${dailySession.compatibilityScore}%` : '0%'}
                          </div>
                          <div className="text-[11px] font-bold text-vgray">Bond Match</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Menu Cards */}
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-vgray px-1 block">
                        Explore Bondly
                      </span>

                      <button
                        onClick={() => setActiveTab('checker')}
                        className="w-full bg-white border border-vborder hover:border-vcoral/30 p-4 rounded-2xl flex items-center justify-between text-left transition-all shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-vcoral flex items-center justify-center text-lg">
                            🔍
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-vcharcoal font-display">Daily Answer Checker</h4>
                            <p className="text-[10px] text-vgray">Reveals all 5 answers once both finish</p>
                          </div>
                        </div>
                        <span className="text-xs text-vcoral font-bold">Open →</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('games')}
                        className="w-full bg-white border border-vborder hover:border-vcoral/30 p-4 rounded-2xl flex items-center justify-between text-left transition-all shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg">
                            🎮
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-vcharcoal font-display">Casual Mini-Games</h4>
                            <p className="text-[10px] text-vgray">This or That, Emoji Guess & more</p>
                          </div>
                        </div>
                        <span className="text-xs text-vcoral font-bold">Play →</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('insights')}
                        className="w-full bg-white border border-vborder hover:border-vcoral/30 p-4 rounded-2xl flex items-center justify-between text-left transition-all shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center text-lg">
                            ✨
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-vcharcoal font-display">AI Compatibility Coach</h4>
                            <p className="text-[10px] text-vgray">5-Dimension bond score analytics</p>
                          </div>
                        </div>
                        <span className="text-xs text-vcoral font-bold">View →</span>
                      </button>
                    </div>

                  </div>
                )}

                {/* VIEWS ROUTER */}
                {activeTab === 'questions' && (
                  <DailyQuestionsView
                    profile={profile}
                    dailySession={dailySession}
                    onUpdateSession={handleUpdateSession}
                    onAddMemory={handleAddMemory}
                  />
                )}

                {activeTab === 'checker' && (
                  <AnswerCheckerView
                    profile={profile}
                    dailySession={dailySession}
                    memories={memories}
                    onUpdateSession={handleUpdateSession}
                  />
                )}

                {activeTab === 'insights' && (
                  <InsightsView
                    profile={profile}
                    dailySession={dailySession}
                    timelineEvents={timelineEvents}
                  />
                )}

                {activeTab === 'games' && (
                  <MiniGamesView />
                )}

                {activeTab === 'profile' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-vborder rounded-3xl p-6 text-center space-y-4 shadow-sm">
                      <div className="w-20 h-20 bg-vsoft border-2 border-vsoft-border rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
                        {profile.avatarUrl}
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-vcharcoal font-display">{profile.name}</h3>
                        <p className="text-xs text-vgray mt-0.5">{profile.email}</p>
                      </div>

                      <div className="p-4 bg-vsoft rounded-2xl border border-vsoft-border text-left space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-vgray font-medium">Pair Code</span>
                          <span className="font-mono font-bold text-vcoral">{profile.roomCode || profile.friendCode}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-vgray font-medium">Partner</span>
                          <span className="font-bold text-vcharcoal">{profile.partnerName}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-vgray font-medium">Streak</span>
                          <span className="font-bold text-vcoral">{profile.streakCount} Days</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm('Disconnect profile and restart onboarding?')) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }}
                        className="w-full py-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                      >
                        Reset / Switch Profile
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Floating Bottom Glass Navigation Bar */}
        {profile && (
          <nav className="absolute bottom-0 left-0 right-0 glass-nav border-t border-vsoft px-3 py-2 flex items-center justify-around z-40">
            {[
              { id: 'home', label: 'Home', icon: Heart },
              { id: 'questions', label: 'Prompts', icon: Sparkles },
              { id: 'checker', label: 'Answers', icon: CheckCircle2 },
              { id: 'insights', label: 'Insights', icon: BarChart3 },
              { id: 'games', label: 'Games', icon: Gamepad2 },
              { id: 'profile', label: 'Profile', icon: User }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all cursor-pointer relative ${
                    isActive ? 'text-vcoral font-bold' : 'text-vgray hover:text-vcharcoal'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'fill-vcoral text-vcoral scale-110' : ''}`} />
                  <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabDot"
                      className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-vcoral"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
}
