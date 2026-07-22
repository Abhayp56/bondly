import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, TrendingUp, Heart, BarChart3, Award, Flame, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { Profile, DailySession, Memory, FriendshipTimelineEvent } from '../types';

interface InsightsProps {
  profile?: Profile | null;
  dailySession?: DailySession | null;
  memories?: Memory[];
  timelineEvents?: FriendshipTimelineEvent[];
}

export default function InsightsView({ 
  profile, 
  dailySession, 
  memories = [], 
  timelineEvents = [] 
}: InsightsProps) {
  const breakdown = dailySession?.breakdown || {
    communication: 0,
    dreams: 0,
    humor: 0,
    emotions: 0,
    lifestyle: 0
  };

  const overallScore = dailySession?.compatibilityScore || 0;
  const completedQuestions = dailySession?.questions?.filter(q => q.answeredByUser && q.answeredByPartner) || [];
  const answeredByUserCount = dailySession?.questions?.filter(q => q.answeredByUser).length || 0;
  const totalQuestions = dailySession?.questions?.length || 5;

  // Find top category from answered questions
  const categoryScores: Record<string, { total: number; count: number }> = {};
  completedQuestions.forEach(q => {
    if (q.similarityScore !== undefined) {
      if (!categoryScores[q.category]) categoryScores[q.category] = { total: 0, count: 0 };
      categoryScores[q.category].total += q.similarityScore;
      categoryScores[q.category].count += 1;
    }
  });

  let topCategory = 'Awaiting Daily Reveal';
  let topCategoryScore = 0;
  Object.entries(categoryScores).forEach(([cat, data]) => {
    const avg = Math.round(data.total / data.count);
    if (avg > topCategoryScore) {
      topCategoryScore = avg;
      topCategory = `${cat} (${avg}% Match)`;
    }
  });

  return (
    <div className="space-y-4">
      
      {/* Overall Score Banner */}
      <div className="bg-gradient-to-br from-vcoral via-rose-500 to-vpink-start text-white p-6 rounded-[32px] shadow-xl shadow-rose-500/15 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-extrabold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-200 fill-amber-200" />
            <span>Gemini Relationship Analysis</span>
          </span>
          <span className="text-2xl font-black font-display">{overallScore > 0 ? `${overallScore}% Match` : 'In Progress'}</span>
        </div>

        <h3 className="text-lg font-extrabold font-display">
          Soul Synergy with {profile?.partnerName || 'Bestie'}
        </h3>
        <p className="text-xs text-white/90 leading-relaxed font-medium">
          {dailySession?.aiSummary || (answeredByUserCount >= 5 
            ? `Waiting for ${profile?.partnerName || 'your partner'} to finish all 5 prompts to unlock your overall AI bond score!` 
            : `Answer today's 5 daily prompts together to reveal live Gemini AI compatibility breakdown and harmony insights!`)}
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-vborder rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="flex items-center space-x-1.5 text-vcoral text-xs font-extrabold uppercase tracking-wider">
            <Flame className="w-4 h-4 fill-vcoral" />
            <span>Streak</span>
          </div>
          <p className="text-xl font-black text-vcharcoal font-display">
            {profile?.streakCount || 0} <span className="text-xs font-bold text-vgray">Days</span>
          </p>
          <span className="text-[10px] text-vgray font-medium block">Daily active connection</span>
        </div>

        <div className="bg-white border border-vborder rounded-3xl p-4 space-y-1 shadow-sm">
          <div className="flex items-center space-x-1.5 text-emerald-600 text-xs font-extrabold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Today's Prompts</span>
          </div>
          <p className="text-xl font-black text-vcharcoal font-display">
            {completedQuestions.length} <span className="text-xs font-bold text-vgray">/ {totalQuestions}</span>
          </p>
          <span className="text-[10px] text-vgray font-medium block">Both answered & revealed</span>
        </div>
      </div>

      {/* 5-Dimension Compatibility Breakdown Cards */}
      <div className="bg-white border border-vborder rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-vcharcoal font-display uppercase tracking-wider flex items-center space-x-1.5">
            <BarChart3 className="w-4 h-4 text-vcoral" />
            <span>5-Dimension Compatibility Breakdown</span>
          </h4>
          <span className="text-[10px] font-bold text-vcoral uppercase">Live Sync</span>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Communication 💬', score: breakdown.communication, color: 'bg-vcoral' },
            { label: 'Emotional Sync 💖', score: breakdown.emotions, color: 'bg-vpink-start' },
            { label: 'Dreams & Future 🌟', score: breakdown.dreams, color: 'bg-purple-500' },
            { label: 'Humor & Fun 🍿', score: breakdown.humor, color: 'bg-amber-500' },
            { label: 'Lifestyle Alignment 🏡', score: breakdown.lifestyle, color: 'bg-emerald-500' }
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-vcharcoal">
                <span>{item.label}</span>
                <span className="text-vcoral font-black">{item.score}%</span>
              </div>
              <div className="h-2.5 w-full bg-vsoft rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full ${item.color} rounded-full`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Friendship Timeline Milestones */}
      <div className="bg-white border border-vborder rounded-3xl p-5 space-y-3 shadow-sm">
        <h4 className="text-xs font-extrabold text-vcharcoal font-display uppercase tracking-wider flex items-center space-x-1.5">
          <Award className="w-4 h-4 text-vcoral" />
          <span>Bond Milestone Timeline</span>
        </h4>

        <div className="space-y-2.5">
          {timelineEvents.map((evt) => (
            <div key={evt.id} className="p-3.5 bg-vsoft border border-vsoft-border rounded-2xl flex items-start space-x-3">
              <div className="text-2xl">{evt.icon}</div>
              <div>
                <h5 className="text-xs font-bold text-vcharcoal font-display">{evt.title}</h5>
                <p className="text-[11px] text-vgray mt-0.5">{evt.description}</p>
                <span className="text-[10px] font-extrabold text-vcoral mt-1 block">{evt.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
