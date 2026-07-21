import React from 'react';
import { motion } from 'motion/react';
import { Crown, Check } from 'lucide-react';
import { Achievement } from '../types';
import { INITIAL_ACHIEVEMENTS } from '../data';

interface AchievementsProps {
  achievements?: Achievement[];
}

export default function AchievementsView({ achievements = INITIAL_ACHIEVEMENTS }: AchievementsProps) {
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-4">
      {/* Trophy Room Banner */}
      <div className="bg-gradient-to-br from-vcoral to-vpink-start text-white p-5 rounded-[32px] flex items-center justify-between shadow-lg shadow-rose-500/15">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">
            👑
          </div>
          <div>
            <h3 className="font-extrabold text-sm font-display">Trophy Room</h3>
            <p className="text-[11px] text-white/90">Unlock badges as your connection grows</p>
          </div>
        </div>

        <div className="bg-white text-vcoral px-3.5 py-1.5 rounded-2xl text-center shadow-md font-display font-extrabold text-sm">
          {earnedCount}/{achievements.length}
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-1 gap-2.5">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${
              ach.earned
                ? 'bg-white border-vsoft-border shadow-sm'
                : 'bg-vsoft/30 border-vborder opacity-60'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="text-2xl p-2.5 bg-vsoft rounded-2xl">{ach.icon}</div>
              <div>
                <h4 className="font-extrabold text-xs text-vcharcoal font-display">{ach.title}</h4>
                <p className="text-[11px] text-vgray mt-0.5">{ach.description}</p>
              </div>
            </div>

            {ach.earned && (
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
