// src/App.jsx
import React, { useState, useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import StudyModule from './components/StudyModule';
import VocabDeck from './components/VocabDeck';
import AiSenseiChat from './components/AiSenseiChat'; // Import our new Chat
import { supabase } from './supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('study_tab') || 'lessons'); 
  const [activeLesson, setActiveLesson] = useState(() => JSON.parse(localStorage.getItem('study_lesson')) || null);
  const [activeDeckId, setActiveDeckId] = useState(() => localStorage.getItem('study_deck') || null);

  const [lessons, setLessons] = useState([]);
  const [vocabDecks, setVocabDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- AI GLOBAL STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [highlightedText, setHighlightedText] = useState("");

  //refresh part
  useEffect(() => {
    localStorage.setItem('study_tab', activeTab);
    activeDeckId ? localStorage.setItem('study_deck', activeDeckId) : localStorage.removeItem('study_deck');
    activeLesson ? localStorage.setItem('study_lesson', JSON.stringify(activeLesson)) : localStorage.removeItem('study_lesson');
  }, [activeTab, activeDeckId, activeLesson]);

  // 1. Fetch Data
  useEffect(() => {
    async function fetchLibrary() {
      setLoading(true);
      
      const { data: decksData } = await supabase.from('decks').select('*');
      const { data: lessonsData } = await supabase.from('essays').select('*');

      if (decksData) {
        // Natural sort to properly order "Deck 2" before "Deck 10"
        const sortedDecks = decksData.sort((a, b) => 
          a.title.localeCompare(b.title, undefined, { numeric: true })
        );
        setVocabDecks(sortedDecks);
      } else {
        setVocabDecks([]);
      }

      if (lessonsData) {
        // Apply the same natural sort to lessons just in case!
        const sortedLessons = lessonsData.sort((a, b) => 
          a.title.localeCompare(b.title, undefined, { numeric: true })
        );
        setLessons(sortedLessons);
      } else {
        setLessons([]);
      }
      
      setLoading(false);
    }
    fetchLibrary();
  }, []);

  // 2. Silent Highlight Listener
  useEffect(() => {
    const handleSelection = () => {
      const text = window.getSelection().toString().trim();
      if (text) {
        setHighlightedText(text);
      }
    };
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  // --- RENDER LOGIC ---
  let mainContent;
  if (activeLesson) {
    mainContent = <StudyModule lessonData={activeLesson.content_data} onBack={() => setActiveLesson(null)} />;
  } else if (activeDeckId) {
    mainContent = <VocabDeck deckId={activeDeckId} onBack={() => setActiveDeckId(null)} />;
  } else if (loading) {
    mainContent = <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-indigo-600 animate-pulse">Loading Library from Cloud...</div>;
  } else {
    mainContent = (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">My Study Library</h1>
              <p className="text-slate-500 font-medium text-lg">Master your Japanese reading and vocabulary.</p>
            </div>
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl">
              <button onClick={() => setActiveTab('lessons')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'lessons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📖 Reading Modules</button>
              <button onClick={() => setActiveTab('vocab')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'vocab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ Vocab Decks</button>
            </div>
          </header>

          {activeTab === 'lessons' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.map((lesson, idx) => (
                <button key={lesson.id} onClick={() => setActiveLesson(lesson)} className="group text-left bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4"><span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Module {idx + 1}</span></div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2 leading-tight">{lesson.title}</h2>
                  <h3 className="text-sm font-japanese text-slate-500 mb-6">{lesson.content_data.topic_japanese}</h3>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'vocab' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vocabDecks.map((deck, idx) => (
                <button key={deck.id} onClick={() => setActiveDeckId(deck.id)} className="group text-left bg-slate-800 text-white p-6 rounded-3xl border border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4"><span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Deck {idx + 1}</span></div>
                    <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{deck.title}</h2>
                    <p className="text-sm text-slate-400 mb-6">Level: {deck.jlpt_level}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full min-h-screen">
      {/* The Main App Content */}
      <div className={`transition-all duration-300 ${isChatOpen ? 'mr-100 opacity-90' : 'mr-0'}`}>
        {mainContent}
      </div>

      {/* The Global Slide-over Chat */}
      <AiSenseiChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        selectedText={highlightedText} 
      />

      {/* Minimalist Floating Trigger (Only shows when chat is closed) */}
      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-8 right-8 bg-slate-800 hover:bg-indigo-600 text-white w-14 h-14 rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.1)] flex items-center justify-center text-2xl transition-all z-40 border border-slate-700"
        >
          ✨
        </button>
      )}
      <SpeedInsights />
    </div>
  );
}