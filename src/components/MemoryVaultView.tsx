import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Search, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';
import { Profile, Memory, FriendshipTimelineEvent } from '../types';
import { getApiUrl } from '../config';

interface MemoryVaultProps {
  profile?: Profile | null;
  memories: Memory[];
  onAddMemory: (memory: Memory) => void;
  onDeleteMemory: (id: string) => void;
  timelineEvents?: FriendshipTimelineEvent[];
}

export default function MemoryVaultView({ 
  profile, 
  memories, 
  onAddMemory, 
  onDeleteMemory,
  timelineEvents = []
}: MemoryVaultProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customUserAns, setCustomUserAns] = useState('');
  const [customPartnerAns, setCustomPartnerAns] = useState('');
  const [monthlyStory, setMonthlyStory] = useState<string | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  const filteredMemories = memories.filter(m => 
    m.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.userAnswer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.partnerAnswer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateStory = async () => {
    setIsGeneratingStory(true);
    try {
      const res = await fetch(getApiUrl('/api/ai/monthly-story'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories })
      });
      if (res.ok) {
        const data = await res.json();
        setMonthlyStory(data.story);
      }
    } catch (e) {
      setMonthlyStory('This month, your bond became noticeably stronger. You learned more about each other\'s dreams and built an unforgettable shared timeline!');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleCreateMemory = () => {
    if (!customQuestion.trim() || !customUserAns.trim() || !customPartnerAns.trim()) return;

    const newMemory: Memory = {
      id: `mem_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      questionText: customQuestion,
      category: 'Friendship',
      userAnswer: customUserAns,
      partnerAnswer: customPartnerAns,
      similarityScore: 92,
      aiCommentary: 'A precious shared memory recorded in your Vault!',
    };

    onAddMemory(newMemory);
    setCustomQuestion('');
    setCustomUserAns('');
    setCustomPartnerAns('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      
      {/* Search & Action Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-vgray" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-vborder rounded-2xl text-xs font-bold text-vcharcoal focus:outline-none focus:border-vcoral"
            placeholder="Search memories..."
          />
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-3 bg-vcoral text-white rounded-2xl shadow-md hover:bg-vcoral-hover transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* AI Monthly Story Card */}
      <div className="bg-gradient-to-br from-vsoft to-white border border-vsoft-border p-5 rounded-[28px] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-vcoral text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-xs text-vcharcoal font-display">Monthly Journal Story</span>
          </div>

          <button
            disabled={isGeneratingStory}
            onClick={handleGenerateStory}
            className="px-3 py-1.5 bg-vcoral text-white rounded-full text-[10px] font-bold shadow-sm hover:bg-vcoral-hover transition-all cursor-pointer"
          >
            {isGeneratingStory ? 'Writing...' : 'Generate AI Story'}
          </button>
        </div>

        {monthlyStory && (
          <p className="text-xs text-vcharcoal font-medium leading-relaxed bg-white p-3.5 rounded-2xl border border-vsoft-border">
            "{monthlyStory}"
          </p>
        )}
      </div>

      {/* Add Memory Modal/Form */}
      {showAddForm && (
        <div className="bg-white border border-vcoral/30 p-5 rounded-3xl space-y-3 shadow-md">
          <h4 className="font-bold text-xs text-vcharcoal uppercase tracking-wider">Log New Shared Memory</h4>
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            className="w-full p-3 bg-vsoft/40 border border-vsoft-border rounded-xl text-xs font-bold text-vcharcoal"
            placeholder="Memory Title / Question"
          />
          <input
            type="text"
            value={customUserAns}
            onChange={(e) => setCustomUserAns(e.target.value)}
            className="w-full p-3 bg-vsoft/40 border border-vsoft-border rounded-xl text-xs font-bold text-vcharcoal"
            placeholder="Your Perspective"
          />
          <input
            type="text"
            value={customPartnerAns}
            onChange={(e) => setCustomPartnerAns(e.target.value)}
            className="w-full p-3 bg-vsoft/40 border border-vsoft-border rounded-xl text-xs font-bold text-vcharcoal"
            placeholder="Bestie's Perspective"
          />
          <button
            onClick={handleCreateMemory}
            className="w-full py-3 bg-vcoral text-white rounded-full font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Save to Memory Vault
          </button>
        </div>
      )}

      {/* Memories Feed */}
      <div className="space-y-3">
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className="bg-white border border-vborder rounded-3xl p-5 space-y-3 shadow-sm hover:border-vsoft-border transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-vsoft text-vcoral border border-vsoft-border rounded-full text-[10px] font-extrabold">
                {mem.category} • {mem.similarityScore}% Match
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-vgray font-bold">{mem.date}</span>
                <button
                  onClick={() => onDeleteMemory(mem.id)}
                  className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <h4 className="font-extrabold text-xs text-vcharcoal font-display leading-snug">
              {mem.questionText}
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-vsoft rounded-2xl border border-vsoft-border">
                <span className="text-[10px] font-bold text-vcoral block uppercase">You</span>
                <span className="font-bold text-vcharcoal">{mem.userAnswer}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 block uppercase">Bestie</span>
                <span className="font-bold text-vcharcoal">{mem.partnerAnswer}</span>
              </div>
            </div>

            {mem.aiCommentary && (
              <p className="text-[11px] text-vgray font-medium italic border-t border-vborder pt-2">
                💡 {mem.aiCommentary}
              </p>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
