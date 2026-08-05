import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Sparkles, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { Profile, BingoState } from '../types';
import BingoView from './BingoView';

interface MiniGamesProps {
  profile: Profile | null;
  bingoState: BingoState | null;
  onUpdateBingoState: (state: BingoState | null) => void;
}

export default function MiniGamesView({ profile, bingoState, onUpdateBingoState }: MiniGamesProps) {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // If a game is active, render it directly
  if (activeGameId === 'bingo' && profile) {
    return (
      <BingoView
        profile={profile}
        bingoState={bingoState}
        onUpdateBingoState={onUpdateBingoState}
        onBack={() => setActiveGameId(null)}
      />
    );
  }

  const games = [
    {
      id: 'bingo',
      title: 'AI Friendship BINGO 🎲',
      description: 'A custom 5x5 board generated from your shared memories and vault answers. Take turns to strike off tiles and hit BINGO!',
      tag: 'Multiplayer Co-op',
      isHot: true,
      locked: false,
      icon: '🎲'
    },
    {
      id: 'doodle',
      title: 'Doodle Showdown 🎨',
      description: 'Draw funny prompts and guess what your partner sketched. Build a shared sketchbook gallery.',
      tag: 'Coming Soon',
      isHot: false,
      locked: true,
      icon: '🎨'
    },
    {
      id: 'wheel',
      title: 'Spicy & Sweet Roulette 🎡',
      description: 'Spin the wheel for customized AI truth or dares. Upload voice messages or text proof to complete.',
      tag: 'Coming Soon',
      isHot: false,
      locked: true,
      icon: '🎡'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Directory Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-black text-vcharcoal font-display">
          Bondly Games Arena 🎮
        </h3>
        <p className="text-xs text-vgray leading-normal">
          Play interactive, real-time mini-games to strengthen your connection and earn bonus XP.
        </p>
      </div>

      {/* Games List */}
      <div className="space-y-3.5">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => !game.locked && setActiveGameId(game.id)}
            disabled={game.locked || !profile}
            className={`w-full text-left bg-white border border-vborder rounded-3xl p-5 flex items-start gap-4 transition-all relative overflow-hidden shadow-sm ${
              game.locked
                ? 'opacity-70 bg-vsoft/30 cursor-not-allowed'
                : 'hover:border-vcoral/35 hover:shadow-md cursor-pointer active:scale-[0.99]'
            }`}
          >
            <div className="w-12 h-12 bg-vsoft border border-vsoft-border rounded-2xl flex items-center justify-center text-2xl shrink-0">
              {game.icon}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-vcharcoal font-display truncate">
                  {game.title}
                </h4>
                {game.isHot && (
                  <span className="text-[8px] uppercase tracking-wider bg-rose-50 text-vcoral border border-rose-100 font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-vgray leading-relaxed font-medium">
                {game.description}
              </p>
              <span className={`inline-block text-[9px] font-bold px-2.5 py-0.5 rounded-md border ${
                game.locked
                  ? 'bg-vsoft border-vborder text-vgray/85'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}>
                {game.tag}
              </span>
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-vgray">
              {game.locked ? (
                <Lock className="w-4 h-4 text-vgray/40" />
              ) : (
                <ChevronRight className="w-5 h-5 text-vcoral" />
              )}
            </div>
          </button>
        ))}

        {!profile && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-2xl text-center">
            ⚠️ Connect your room code in the Profile or Home tab to unlock multiplayer games!
          </div>
        )}
      </div>
    </div>
  );
}
