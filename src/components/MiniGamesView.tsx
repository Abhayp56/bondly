import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { Profile, MiniGame } from '../types';
import confetti from 'canvas-confetti';

interface MiniGamesProps {
  profile?: Profile | null;
}

const INITIAL_MINIGAMES: MiniGame[] = [
  {
    id: 'mg_1',
    type: 'this_or_that',
    title: 'This or That 🍕🍔',
    question: 'Late Night Cravings: Pizza or Burger?',
    options: ['🍕 Pizza Slice', '🍔 Double Burger'],
    revealed: false
  },
  {
    id: 'mg_2',
    type: 'would_you_rather',
    title: 'Would You Rather? 🏕️🏨',
    question: 'Spend a weekend in a luxury five-star hotel or camping deep in the peaceful forest?',
    options: ['⛺ Camping Wilderness', '🏨 5-Star Luxury Hotel'],
    revealed: false
  },
  {
    id: 'mg_3',
    type: 'emoji_guess',
    title: 'Emoji Guesser 🤫💭',
    question: 'Guess what your partner is feeling based on this emoji combo: 🏔️☕🧣',
    options: ['🏂 Extreme snowboarding', '🏡 Warm cabin getaway', '☕ Monday morning commute'],
    revealed: false
  }
];

export default function MiniGamesView({ profile }: MiniGamesProps) {
  const [games, setGames] = useState<MiniGame[]>(INITIAL_MINIGAMES);
  const [activeGameId, setActiveGameId] = useState<string>('mg_1');

  const activeGame = games.find(g => g.id === activeGameId) || games[0];

  const handleSelectOption = (option: string) => {
    if (activeGame.revealed) return;

    const partnerChoice = activeGame.options ? activeGame.options[0] : option;
    const isSame = option === partnerChoice;
    const score = isSame ? 100 : 75;

    const updated = games.map(g => {
      if (g.id === activeGame.id) {
        return {
          ...g,
          userSelection: option,
          partnerSelection: partnerChoice,
          revealed: true,
          similarityScore: score,
          aiCommentary: isSame
            ? 'Incredible mind-reading connection! You both chose the exact same option!'
            : 'Complementary tastes make for the best adventures!'
        };
      }
      return g;
    });

    setGames(updated);
    confetti({ particleCount: 70, spread: 50, origin: { y: 0.7 } });
  };

  return (
    <div className="space-y-4">
      {/* Game Selector Pills */}
      <div className="flex space-x-2 overflow-x-auto py-1">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => setActiveGameId(game.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
              activeGameId === game.id
                ? 'bg-vcoral text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-vgray border border-vborder hover:bg-vsoft'
            }`}
          >
            {game.title}
          </button>
        ))}
      </div>

      {/* Game Play Card */}
      <div className="bg-white border border-vborder rounded-[32px] p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 bg-vsoft text-vcoral border border-vsoft-border rounded-full text-[10px] font-extrabold uppercase">
            {activeGame.type.replace('_', ' ')}
          </span>
        </div>

        <h3 className="text-base font-extrabold text-vcharcoal font-display leading-snug">
          {activeGame.question}
        </h3>

        {!activeGame.revealed ? (
          <div className="space-y-2.5 pt-2">
            {activeGame.options?.map(opt => (
              <button
                key={opt}
                onClick={() => handleSelectOption(opt)}
                className="w-full p-4 bg-vsoft/50 border border-vsoft-border hover:border-vcoral hover:bg-vsoft text-vcharcoal rounded-2xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer"
              >
                <span>{opt}</span>
                <span className="text-vcoral font-bold text-xs">Select →</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="p-4 bg-gradient-to-r from-vcoral to-vpink-start text-white rounded-2xl space-y-1 shadow-md">
              <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                Result: {activeGame.similarityScore}% Sync
              </span>
              <p className="text-xs font-medium pt-1 leading-relaxed">
                "{activeGame.aiCommentary}"
              </p>
            </div>

            <button
              onClick={() => {
                const reset = games.map(g => g.id === activeGame.id ? { ...g, revealed: false } : g);
                setGames(reset);
              }}
              className="w-full py-3 bg-vsoft border border-vsoft-border text-vcoral font-bold rounded-full text-xs cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
