import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, TrendingUp, Heart, BarChart3, Award } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      
      {/* Overall Score Banner */}
      <div className="bg-gradient-to-br from-vcoral to-vpink-start text-white p-6 rounded-[32px] shadow-xl shadow-rose-500/15 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-extrabold bg-white/20 px-3 py-1 rounded-full">
            Gemini Relationship Analysis
          </span>
          <span className="text-2xl font-black font-display">{overallScore}% Match</span>
        </div>

        <h3 className="text-lg font-extrabold font-display">
          Soul Synergy with {profile?.partnerName || 'Bestie'}
        </h3>
        <p className="text-xs text-white/90 leading-relaxed font-medium">
          {dailySession?.aiSummary || "Complete today's daily prompts together to calculate your live Gemini AI compatibility breakdown!"}
        </p>
      </div>

      {/* 5-Dimension Compatibility Breakdown Cards */}
      <div className="bg-white border border-vborder rounded-3xl p-5 space-y-4 shadow-sm">
        <h4 className="text-xs font-extrabold text-vcharcoal font-display uppercase tracking-wider">
          5-Dimension Compatibility Breakdown
        </h4>

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
                <span className="text-vcoral">{item.score}%</span>
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
        <h4 className="text-xs font-extrabold text-vcharcoal font-display uppercase tracking-wider">
          Bond Milestone Timeline
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
