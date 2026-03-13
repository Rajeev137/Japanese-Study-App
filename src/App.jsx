// src/App.jsx
import React, { useState, useEffect } from 'react';
import StudyModule from './components/StudyModule';
import VocabDeck from './components/VocabDeck';
import KanjiDeck from './components/KanjiDeck';
import AiSenseiChat from './components/AiSenseiChat';
import { supabase } from './supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('study_tab') || 'lessons'); 
  const [activeLesson, setActiveLesson] = useState(() => JSON.parse(localStorage.getItem('study_lesson')) || null);
  const [activeDeckId, setActiveDeckId] = useState(() => localStorage.getItem('study_deck') || null);

  const [lessons, setLessons] = useState([]);
  const [vocabDecks, setVocabDecks] = useState([]);
  const [kanjiDecks, setKanjiDecks] = useState([]);
  
  // Progress tracking state
  const [srsProgress, setSrsProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [highlightedText, setHighlightedText] = useState("");

  useEffect(() => {
    localStorage.setItem('study_tab', activeTab);
    activeDeckId ? localStorage.setItem('study_deck', activeDeckId) : localStorage.removeItem('study_deck');
    activeLesson ? localStorage.setItem('study_lesson', JSON.stringify(activeLesson)) : localStorage.removeItem('study_lesson');
  }, [activeTab, activeDeckId, activeLesson]);

  // Fetch Library & Progress
  useEffect(() => {
    async function fetchLibrary() {
      setLoading(true);
      
      // 1. Fetch all decks with their card counts
      const { data: decksData } = await supabase
        .from('decks')
        .select('*, vocab_cards(id), kanji_cards(id)');
        
      // 2. Fetch lessons
      const { data: lessonsData } = await supabase.from('essays').select('*');
      
      // 3. Fetch active SRS progress (where next_review is in the future)
      const { data: progressData } = await supabase
        .from('srs_progress')
        .select('*')
        .gt('next_review', new Date().toISOString());

      if (decksData) {
        const sortedDecks = decksData.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        setVocabDecks(sortedDecks.filter(d => d.deck_type === 'vocab' || !d.deck_type));
        setKanjiDecks(sortedDecks.filter(d => d.deck_type === 'kanji'));
      }

      if (lessonsData) {
        setLessons(lessonsData.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })));
      }
      
      if (progressData) {
        setSrsProgress(progressData);
      }
      
      setLoading(false);
    }
    
    // Only fetch if we are on the main dashboard
    if (!activeLesson && !activeDeckId) {
      fetchLibrary();
    }
  }, [activeLesson, activeDeckId]);

  // Silent Highlight Listener
  useEffect(() => {
    const handleSelection = () => {
      const text = window.getSelection().toString().trim();
      if (text) setHighlightedText(text);
    };
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  // Calculate Progress Helper
  const getDeckProgress = (deck) => {
    const isKanji = deck.deck_type === 'kanji';
    const totalCards = isKanji ? (deck.kanji_cards?.length || 0) : (deck.vocab_cards?.length || 0);
    if (totalCards === 0) return { total: 0, done: 0, percentage: 0 };

    // Count how many cards in this deck have a future next_review date in srsProgress
    const cardIdsInDeck = isKanji ? deck.kanji_cards.map(c => c.id) : deck.vocab_cards.map(c => c.id);
    const doneCards = srsProgress.filter(p => 
      isKanji ? cardIdsInDeck.includes(p.kanji_card_id) : cardIdsInDeck.includes(p.vocab_card_id)
    ).length;

    return {
      total: totalCards,
      done: doneCards,
      percentage: Math.round((doneCards / totalCards) * 100)
    };
  };

  // Circular Dial Component
  const ProgressDial = ({ progress }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress.percentage / 100) * circumference;

    return (
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r={radius} className="stroke-slate-600" strokeWidth="4" fill="transparent" />
            <circle cx="20" cy="20" r={radius} className="stroke-indigo-400 transition-all duration-500 ease-in-out" strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
          </svg>
          <span className="absolute text-[10px] font-bold text-white">{progress.percentage}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-indigo-300">{progress.done} / {progress.total}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Learned</span>
        </div>
      </div>
    );
  };

  // --- RENDER LOGIC ---
  let mainContent;
  if (activeLesson) {
    mainContent = <StudyModule lessonData={activeLesson.content_data} onBack={() => setActiveLesson(null)} />;
  } else if (activeDeckId) {
    const activeDeck = [...vocabDecks, ...kanjiDecks].find(d => d.id === activeDeckId);
    if (activeDeck?.deck_type === 'kanji') {
      mainContent = <KanjiDeck deckId={activeDeckId} onBack={() => setActiveDeckId(null)} />;
    } else {
      mainContent = <VocabDeck deckId={activeDeckId} onBack={() => setActiveDeckId(null)} />;
    }
  } else if (loading) {
    mainContent = <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-indigo-600 animate-pulse text-xl">Loading Library...</div>;
  } else {
    mainContent = (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">My Study Library</h1>
              <p className="text-slate-500 font-medium text-lg">Master your Japanese reading, vocab, and kanji.</p>
            </div>
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl overflow-x-auto w-full lg:w-auto">
              <button onClick={() => setActiveTab('lessons')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'lessons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📖 Reading Modules</button>
              <button onClick={() => setActiveTab('vocab')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'vocab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ Vocab Decks</button>
              <button onClick={() => setActiveTab('kanji')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'kanji' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>✍️ Kanji Decks</button>
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
          
          {(activeTab === 'vocab' || activeTab === 'kanji') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === 'vocab' ? vocabDecks : kanjiDecks).map((deck, idx) => {
                const progress = getDeckProgress(deck);
                return (
                  <button key={deck.id} onClick={() => setActiveDeckId(deck.id)} className="group text-left bg-slate-800 text-white p-6 rounded-3xl border border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between h-full relative overflow-hidden min-h-[200px]">
                    <div className="relative z-10 mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Deck {idx + 1}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1 leading-tight">{deck.title}</h2>
                      <p className="text-sm text-slate-400">Level: {deck.jlpt_level}</p>
                    </div>
                    
                    {/* The Progress Dial */}
                    <div className="relative z-10 pt-4 border-t border-slate-700">
                      <ProgressDial progress={progress} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full min-h-screen">
      <div className={`transition-all duration-300 ${isChatOpen ? 'mr-100 opacity-90' : 'mr-0'}`}>
        {mainContent}
      </div>
      <AiSenseiChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedText={highlightedText} />
      {!isChatOpen && (
        <button onClick={() => setIsChatOpen(true)} className="fixed bottom-8 right-8 bg-slate-800 hover:bg-indigo-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center text-2xl transition-all z-40">
          ✨
        </button>
      )}
    </div>
  );
}