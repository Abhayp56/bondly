import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Sparkles, User, Users, ArrowRight, Copy, Check } from 'lucide-react';
import { Profile } from '../types';
import { getApiUrl } from '../config';

interface OnboardingProps {
  onComplete: (profile: Profile, roomState?: any) => void;
}

const AVATARS = ['🦊', '🐹', '🐼', '🐨', '🦄', '🐯', '🐰', '🦁', '🦉', '🐱'];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦊');
  const [mode, setMode] = useState<'ai' | 'create_room' | 'join_room'>('create_room');
  const [pairCode, setPairCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateRoom = async (myProfile: Profile) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/rooms/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: myProfile })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data.roomCode);
        setStep(3);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to create room. Please try again.');
      }
    } catch (e) {
      console.error('Create room error:', e);
      setErrorMsg('Unable to connect to server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (myProfile: Profile) => {
    if (!pairCode.trim()) {
      setErrorMsg('Please enter a valid Pair Code');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/rooms/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: pairCode, profile: myProfile })
      });
      if (res.ok) {
        const data = await res.json();
        onComplete(data.profile, data.roomState);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Pair Code not found. Check code & try again.');
      }
    } catch (e) {
      setErrorMsg('Failed to connect room.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedMode = () => {
    const defaultProfile: Profile = {
      id: `usr_${Date.now()}`,
      name: name || 'Taylor',
      email: 'taylor@bondly.app',
      avatarUrl: avatar,
      friendCode: `BOND-${Math.floor(1000 + Math.random() * 9000)}`,
      partnerCode: mode === 'ai' ? 'AI-GEMINI' : 'BOND-HOST',
      partnerName: mode === 'ai' ? 'Gemini AI' : 'Bestie',
      partnerAvatarUrl: mode === 'ai' ? '✨' : '🌸',
      connected: mode !== 'create_room',
      friendSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      streakCount: 0,
    };

    if (mode === 'ai') {
      onComplete(defaultProfile);
    } else if (mode === 'create_room') {
      handleCreateRoom(defaultProfile);
    } else if (mode === 'join_room') {
      setStep(3);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full space-y-6"
      >
        {/* Progress Dots */}
        <div className="flex justify-center space-x-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step ? 'w-8 bg-vcoral' : 'w-2 bg-vsoft-border'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-vcoral to-vpink-start rounded-3xl mx-auto flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Heart className="w-8 h-8 fill-white" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-vcharcoal font-display">Welcome to Bondly</h1>
              <p className="text-xs text-vgray font-medium leading-relaxed max-w-xs mx-auto">
                Connect daily with your best friend through interactive prompts & Gemini AI compatibility commentary.
              </p>
            </div>

            <div className="space-y-4 text-left bg-white p-5 rounded-3xl border border-vborder shadow-sm">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-vgray" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-vsoft/50 border border-vsoft-border rounded-2xl text-xs font-bold text-vcharcoal focus:outline-none focus:border-vcoral focus:bg-white transition-all"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-vgray mb-1.5">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.slice(0, 5).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setAvatar(emoji)}
                      className={`text-2xl p-2.5 rounded-2xl border transition-all cursor-pointer ${
                        avatar === emoji
                          ? 'bg-vsoft border-vcoral scale-105 shadow-sm'
                          : 'bg-white border-vborder hover:bg-vsoft/30'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-4 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 bg-vsoft rounded-3xl mx-auto flex items-center justify-center text-vcoral text-2xl">
              ✨
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-vcharcoal font-display">How To Play</h2>
              <p className="text-xs text-vgray font-medium">Choose how you want to connect today</p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3 text-left">
              <button
                onClick={() => setMode('create_room')}
                className={`w-full p-4 rounded-3xl border transition-all flex items-start space-x-3 cursor-pointer ${
                  mode === 'create_room'
                    ? 'border-vcoral bg-vsoft shadow-sm'
                    : 'border-vborder bg-white hover:border-vsoft-border'
                }`}
              >
                <div className="text-2xl p-2 bg-white rounded-2xl shadow-sm">👑</div>
                <div>
                  <h3 className="font-extrabold text-xs text-vcharcoal font-display">Create Pair Code (Host 2 Phones)</h3>
                  <p className="text-[11px] text-vgray mt-0.5 leading-snug">Generate a 4-digit code to send to your bestie so you both play live.</p>
                </div>
              </button>

              <button
                onClick={() => setMode('join_room')}
                className={`w-full p-4 rounded-3xl border transition-all flex items-start space-x-3 cursor-pointer ${
                  mode === 'join_room'
                    ? 'border-vcoral bg-vsoft shadow-sm'
                    : 'border-vborder bg-white hover:border-vsoft-border'
                }`}
              >
                <div className="text-2xl p-2 bg-white rounded-2xl shadow-sm">🔗</div>
                <div>
                  <h3 className="font-extrabold text-xs text-vcharcoal font-display">Enter Friend's Pair Code</h3>
                  <p className="text-[11px] text-vgray mt-0.5 leading-snug">Got a code from your friend? Link your phone directly to her room.</p>
                </div>
              </button>

              <button
                onClick={() => setMode('ai')}
                className={`w-full p-4 rounded-3xl border transition-all flex items-start space-x-3 cursor-pointer ${
                  mode === 'ai'
                    ? 'border-vcoral bg-vsoft shadow-sm'
                    : 'border-vborder bg-white hover:border-vsoft-border'
                }`}
              >
                <div className="text-2xl p-2 bg-white rounded-2xl shadow-sm">✨</div>
                <div>
                  <h3 className="font-extrabold text-xs text-vcharcoal font-display">Play Solo with Gemini AI</h3>
                  <p className="text-[11px] text-vgray mt-0.5 leading-snug">Gemini acts as your companion, generating authentic answers & insights.</p>
                </div>
              </button>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 bg-white border border-vborder text-vcharcoal rounded-full font-bold text-xs cursor-pointer hover:bg-vsoft/30 transition-all"
              >
                Back
              </button>
              <button
                disabled={isLoading}
                onClick={handleProceedMode}
                className="w-2/3 py-3.5 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold shadow-lg shadow-rose-500/20 text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Connecting...' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 text-center">
            {mode === 'create_room' && (
              <div className="space-y-5">
                <div className="w-14 h-14 bg-vsoft rounded-3xl mx-auto flex items-center justify-center text-vcoral text-2xl">
                  👑
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-vcharcoal font-display">Your Live Pair Code</h2>
                  <p className="text-xs text-vgray mt-1">Send this code to your best friend to pair phones!</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-vsoft-border shadow-sm space-y-3">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase text-vgray block">PAIR CODE</span>
                  <div className="text-3xl font-mono font-black text-vcoral tracking-widest">{generatedCode}</div>
                  <button
                    onClick={copyCode}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-vcoral text-white rounded-full text-xs font-bold shadow-md hover:bg-vcoral-hover transition-all cursor-pointer"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="p-4 bg-vsoft border border-vsoft-border rounded-2xl text-[11px] text-vcharcoal text-left font-medium leading-relaxed">
                  💡 <strong>Tell your bestie:</strong> Share this 6-digit Pair Code with her so she can tap <strong>"Enter Friend's Pair Code"</strong> on her phone!
                </div>

                <button
                  onClick={() => {
                    fetch(getApiUrl(`/api/rooms/${generatedCode}?slot=user1`))
                      .then(res => res.json())
                      .then(data => onComplete(data.roomState.profile, data.roomState));
                  }}
                  className="w-full py-4 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-wider cursor-pointer"
                >
                  <span>Enter Game Lobby</span>
                  <Sparkles className="w-4 h-4 fill-white" />
                </button>
              </div>
            )}

            {mode === 'join_room' && (
              <div className="space-y-5">
                <div className="w-14 h-14 bg-vsoft rounded-3xl mx-auto flex items-center justify-center text-vcoral text-2xl">
                  🔗
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-vcharcoal font-display">Enter Pair Code</h2>
                  <p className="text-xs text-vgray mt-1">Enter the 4-digit code shown on your friend's phone</p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <input
                  type="text"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                  className="w-full py-4 px-4 bg-white border-2 border-vcoral/30 rounded-3xl text-center font-mono text-2xl font-black tracking-widest text-vcoral uppercase focus:outline-none focus:border-vcoral shadow-sm"
                  placeholder="BOND-XXXX"
                />

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="w-1/3 py-3.5 bg-white border border-vborder text-vcharcoal rounded-full font-bold text-xs cursor-pointer hover:bg-vsoft/30 transition-all"
                  >
                    Back
                  </button>
                  <button
                    disabled={isLoading || !pairCode.trim()}
                    onClick={() => {
                      const defaultProfile: Profile = {
                        id: `usr_${Date.now()}`,
                        name: name || 'Taylor',
                        email: 'taylor@bondly.app',
                        avatarUrl: avatar,
                        friendCode: `BOND-${Math.floor(1000 + Math.random() * 9000)}`,
                        partnerCode: 'BOND-HOST',
                        partnerName: 'Bestie',
                        partnerAvatarUrl: '🌸',
                        connected: true,
                        friendSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                        streakCount: 0,
                      };
                      handleJoinRoom(defaultProfile);
                    }}
                    className="w-2/3 py-3.5 bg-vcoral hover:bg-vcoral-hover text-white rounded-full font-bold shadow-lg shadow-rose-500/25 text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Linking...' : 'Connect Phones'}</span>
                    <Sparkles className="w-4 h-4 fill-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
