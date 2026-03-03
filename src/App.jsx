// src/App.jsx
import React, { useState } from 'react';
import StudyModule from './components/StudyModule';
import VocabDeck from './components/VocabDeck';
import { lessonLibrary, vocabLibrary } from './data/index.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' or 'vocab'
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeDeck, setActiveDeck] = useState(null);

  // ROUTER: If a Lesson is active, show StudyModule
  if (activeLesson) {
    return <StudyModule lessonData={activeLesson} onBack={() => setActiveLesson(null)} />;
  }

  // ROUTER: If a Deck is active, show VocabDeck
  if (activeDeck) {
    return <VocabDeck deckData={activeDeck} onBack={() => setActiveDeck(null)} />;
  }

  // DASHBOARD UI
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">My Study Library</h1>
            <p className="text-slate-500 font-medium text-lg">Master your Japanese reading and vocabulary.</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex bg-slate-200/50 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('lessons')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'lessons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              📖 Reading Modules
            </button>
            <button 
              onClick={() => setActiveTab('vocab')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'vocab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              🗂️ Vocab Decks
            </button>
          </div>
        </header>

        {/* LESSONS GRID */}
        {activeTab === 'lessons' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {lessonLibrary.map((lesson, idx) => (
              <button
                key={idx}
                onClick={() => setActiveLesson(lesson)}
                className="group text-left bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Module {idx + 1}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2 leading-tight">{lesson.topic_english}</h2>
                <h3 className="text-sm font-japanese text-slate-500 mb-6">{lesson.topic_japanese}</h3>
              </button>
            ))}
          </div>
        )}

        {/* VOCAB DECKS GRID */}
        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {vocabLibrary.map((deck, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDeck(deck)}
                className="group text-left bg-slate-800 text-white p-6 rounded-3xl border border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute -right-6 -top-6 text-slate-700/50 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H216v64H40ZM216,200H40V136H216v64Z"></path></svg>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Deck {idx + 1}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{deck.deck_title}</h2>
                  <p className="text-sm text-slate-400 mb-6 line-clamp-2">{deck.deck_description}</p>
                  <div className="mt-auto pt-4 border-t border-slate-700/50 flex items-center text-xs font-bold text-indigo-300">
                    {deck.vocabulary?.length || 0} Words Inside →
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}