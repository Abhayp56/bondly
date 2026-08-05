import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCw, ChevronLeft, HelpCircle, User, Star, Award, MessageCircle } from 'lucide-react';
import { Profile, BingoState } from '../types';
import { getApiUrl } from '../config';
import confetti from 'canvas-confetti';

interface BingoViewProps {
  profile: Profile;
  bingoState: BingoState | null;
  onUpdateBingoState: (state: BingoState | null) => void;
  onBack: () => void;
}

export default function BingoView({ profile, bingoState, onUpdateBingoState, onBack }: BingoViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = profile.slot || 'user1';
  const myBoard = bingoState ? (slot === 'user1' ? bingoState.boardUser1 : bingoState.boardUser2) : [];
  const myCompletedLines = bingoState ? (slot === 'user1' ? bingoState.completedLinesUser1 : bingoState.completedLinesUser2) : [];
  const partnerCompletedLines = bingoState ? (slot === 'user1' ? bingoState.completedLinesUser2 : bingoState.completedLinesUser1) : [];

  const isMyTurn = bingoState && bingoState.currentTurn === slot;
  const partnerName = profile.partnerName || 'Partner';
  
  // Confetti effect on line completion count change
  useEffect(() => {
    if (myCompletedLines && myCompletedLines.length > 0) {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }
  }, [myCompletedLines?.length]);

  // Confetti on win
  useEffect(() => {
    if (bingoState && bingoState.winner === slot) {
      const end = Date.now() + (2 * 1000);
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [bingoState?.winner]);

  const handleStartGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}/bingo/start`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start game');
      }
      const data = await res.json();
      if (data.roomState) {
        onUpdateBingoState(data.roomState.bingoState);
      }
    } catch (e: any) {
      setError(e.message || 'Error starting BINGO');
    } finally {
      setLoading(false);
    }
  };

  const handleCallItem = async (item: string) => {
    if (!bingoState || !isMyTurn || bingoState.winner || loading) return;
    
    // Optimistic strike-through
    const oldState = { ...bingoState };
    const updatedMarked = [...bingoState.markedItems, item];
    onUpdateBingoState({
      ...bingoState,
      markedItems: updatedMarked
    });

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}/bingo/call`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, item })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to call item');
      }
      const data = await res.json();
      if (data.roomState) {
        onUpdateBingoState(data.roomState.bingoState);
      }
    } catch (e: any) {
      // Revert optimism
      onUpdateBingoState(oldState);
      setError(e.message || 'Error calling item');
    } finally {
      setLoading(false);
    }
  };

  const handleResetGame = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${profile.roomCode}/bingo/reset`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.roomState) {
          onUpdateBingoState(data.roomState.bingoState);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a cell index is part of a completed winning line
  const isCellInCompletedLine = (cellIdx: number) => {
    const BINGO_WINNING_LINES = [
      [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // rows
      [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // cols
      [0, 6, 12, 18, 24], [4, 8, 12, 16, 20] // diagonals
    ];

    return myCompletedLines.some(lineIdx => BINGO_WINNING_LINES[lineIdx].includes(cellIdx));
  };

  return (
    <div className="space-y-4">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-vsoft border border-vsoft-border rounded-full text-xs font-extrabold text-vcoral cursor-pointer hover:bg-vsoft/85 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Hub</span>
        </button>

        <span className="text-xs font-bold text-vgray">
          Multiplayer AI BINGO
        </span>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* LOBBY / INITIAL STATE */}
      {(!bingoState || !bingoState.gameActive) && !bingoState?.winner && (
        <div className="bg-white border border-vborder rounded-[32px] p-6 space-y-6 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-tr from-rose-50 to-vsoft text-vcoral rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🎮
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-black text-vcharcoal font-display leading-tight">
              AI Friendship BINGO
            </h3>
            <p className="text-xs text-vgray leading-relaxed max-w-xs mx-auto">
              Our AI engine will analyze your memory vault and create a custom board of 25 shared memories. Shuffled differently on each screen!
            </p>
          </div>

          <div className="p-4 bg-vsoft rounded-2xl border border-vsoft-border text-left space-y-2.5">
            <div className="flex items-start space-x-2">
              <span className="text-sm">⚡</span>
              <p className="text-[11px] text-vcharcoal font-medium leading-normal">
                Take turns selecting tiles. When a tile is selected, it strikes off on both boards.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-sm">🏆</span>
              <p className="text-[11px] text-vcharcoal font-medium leading-normal">
                Earn 50 XP per line. Complete 5 rows, cols, or diagonals first to hit BINGO and win!
              </p>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-vcoral to-vpink-start text-white text-xs font-extrabold rounded-2xl cursor-pointer shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Generate Board & Start Game</span>
                <Star className="w-4 h-4 fill-white" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ACTIVE BINGO GAME BOARD */}
      {bingoState && (bingoState.gameActive || bingoState.winner) && (
        <div className="space-y-4">
          
          {/* Header Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white border border-vborder rounded-2xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🎖️</span>
                <div>
                  <span className="text-[9px] text-vgray font-bold block uppercase leading-none">Your Lines</span>
                  <span className="text-sm font-black text-vcoral font-display">{myCompletedLines.length} / 5</span>
                </div>
              </div>
              <span className="text-xs bg-rose-50 text-vcoral font-bold px-2 py-0.5 rounded-md">
                {myCompletedLines.length * 50} XP
              </span>
            </div>

            <div className="bg-white border border-vborder rounded-2xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-lg">👥</span>
                <div>
                  <span className="text-[9px] text-vgray font-bold block uppercase leading-none">{partnerName}</span>
                  <span className="text-sm font-black text-vgray font-display">{partnerCompletedLines.length} / 5</span>
                </div>
              </div>
              <span className="text-xs bg-vsoft text-vgray font-bold px-2 py-0.5 rounded-md">
                {partnerCompletedLines.length * 50} XP
              </span>
            </div>
          </div>

          {/* Turn Banner or Win Card */}
          {bingoState.winner ? (
            <div className="bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300 text-white rounded-3xl p-5 text-center space-y-3.5 shadow-md">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
                🏆
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black font-display uppercase tracking-wide">
                  {bingoState.winner === slot ? '🎉 BINGO! You Won!' : bingoState.winner === 'draw' ? '🤝 ITS A DRAW!' : `👏 ${partnerName} Won!`}
                </h4>
                <p className="text-xs text-white/90 font-medium">
                  {bingoState.winner === slot 
                    ? `Incredible memory connection! You completed 5 lines first and earned ${myCompletedLines.length * 50} XP!`
                    : `Great game! Better luck next round.`}
                </p>
              </div>
              <button
                onClick={handleResetGame}
                className="bg-white text-amber-600 px-6 py-2.5 rounded-full text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Play Again</span>
              </button>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border text-center transition-all flex items-center justify-between shadow-sm ${
              isMyTurn
                ? 'bg-rose-50 border-rose-200 text-vcoral'
                : 'bg-vsoft border-vsoft-border text-vgray'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? 'bg-vcoral animate-pulse' : 'bg-vgray/50'}`} />
                <span className="text-xs font-extrabold">
                  {isMyTurn ? 'Your Turn: Tap a tile to call it!' : `Waiting for ${partnerName}...`}
                </span>
              </div>
              {bingoState.lastActionDesc && (
                <span className="text-[10px] font-bold text-vgray italic text-right max-w-[50%] block truncate">
                  "{bingoState.lastActionDesc}"
                </span>
              )}
            </div>
          )}

          {/* 5x5 BINGO GRID */}
          <div className="grid grid-cols-5 gap-1.5 bg-vsoft p-2 rounded-[28px] border border-vborder relative overflow-hidden">
            {myBoard.map((item, idx) => {
              const isMarked = bingoState.markedItems.some(i => i.trim().toLowerCase() === item.trim().toLowerCase());
              const isInWinLine = isCellInCompletedLine(idx);
              
              return (
                <button
                  key={idx}
                  onClick={() => handleCallItem(item)}
                  disabled={!isMyTurn || isMarked || !!bingoState.winner || loading}
                  className={`relative aspect-square w-full rounded-2xl text-[9px] font-black leading-tight flex flex-col items-center justify-center p-1 text-center transition-all select-none cursor-pointer overflow-hidden ${
                    isInWinLine
                      ? 'bg-gradient-to-tr from-amber-300 to-amber-400 text-amber-950 border border-amber-400 shadow-md shadow-amber-500/10'
                      : isMarked
                      ? 'bg-rose-50 text-vcoral border border-rose-100 shadow-inner'
                      : 'bg-white text-vcharcoal border border-vborder hover:border-vcoral/45 active:bg-vsoft'
                  }`}
                >
                  <span className="block break-words w-full px-0.5">
                    {item.split(' ')[0]}
                  </span>
                  <span className="block text-xs mt-0.5">
                    {item.split(' ').slice(1).join(' ') || '✨'}
                  </span>

                  {/* Dynamic SVG line drawing animation for marked cells */}
                  <AnimatePresence>
                    {isMarked && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80" viewBox="0 0 100 100">
                        <motion.line
                          x1="12" y1="88" x2="88" y2="12"
                          stroke={isInWinLine ? "#B45309" : "#FF466E"}
                          strokeWidth="8"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </svg>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          {/* Reset Button (Only shown during active game to reset) */}
          {!bingoState.winner && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to end this game and clear the board?')) {
                  handleResetGame();
                }
              }}
              className="w-full py-3 bg-white hover:bg-rose-50/50 border border-vborder text-vgray hover:text-rose-600 rounded-2xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Game Board</span>
            </button>
          )}

        </div>
      )}
    </div>
  );
}
