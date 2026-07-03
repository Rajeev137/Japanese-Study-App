import React, { useState, useEffect } from "react";
import StudyModule from "./components/StudyModule";
import VocabDeck from "./components/VocabDeck";
import KanjiDeck from "./components/KanjiDeck";
import VerbDeck from "./components/VerbDeck";
import AiSenseiChat from "./components/AiSenseiChat";
import ImmersionGateway from "./components/ImmersionGateway";
import Dashboard from "./components/Dashboard";
import ContentStudio from "./components/ContentStudio";
import ReviewSession from "./components/ReviewSession";
import { supabase } from "./supabaseClient";

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("study_tab") || "home",
  );
  const [activeLesson, setActiveLesson] = useState(
    () => JSON.parse(localStorage.getItem("study_lesson")) || null,
  );
  const [activeDeckId, setActiveDeckId] = useState(
    () => localStorage.getItem("study_deck") || null,
  );

  const [lessons, setLessons] = useState([]);
  const [vocabDecks, setVocabDecks] = useState([]);
  const [kanjiDecks, setKanjiDecks] = useState([]);
  const [srsProgress, setSrsProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [highlightedText, setHighlightedText] = useState("");
  const [reviewSession, setReviewSession] = useState(null); // null | {scope:'global'}
  const [refreshKey, setRefreshKey] = useState(0);

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  // Sidebar open/closed — persisted
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => localStorage.getItem("sidebar_open") !== "false",
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("sidebar_open", isSidebarOpen ? "true" : "false");
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("study_tab", activeTab);
    activeDeckId
      ? localStorage.setItem("study_deck", activeDeckId)
      : localStorage.removeItem("study_deck");
    activeLesson
      ? localStorage.setItem("study_lesson", JSON.stringify(activeLesson))
      : localStorage.removeItem("study_lesson");
  }, [activeTab, activeDeckId, activeLesson]);

  useEffect(() => {
    async function fetchLibrary() {
      setLoading(true);
      const { data: decksData } = await supabase.from("decks").select("*, vocab_cards(id), kanji_cards(id)");
      const { data: lessonsData } = await supabase.from("essays").select("*");
      const { data: progressData } = await supabase.from("srs_progress").select("*");

      if (decksData) {
        const sortedDecks = decksData.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        setVocabDecks(sortedDecks.filter((d) => d.deck_type === "vocab" || !d.deck_type));
        setKanjiDecks(sortedDecks.filter((d) => d.deck_type === "kanji"));
      }
      if (lessonsData) {
        setLessons(lessonsData.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })));
      }
      if (progressData) {
        setSrsProgress(progressData);
      }
      setLoading(false);
    }

    if (!activeLesson && !activeDeckId && !reviewSession) fetchLibrary();
  }, [activeLesson, activeDeckId, reviewSession, refreshKey]);

  useEffect(() => {
    const handleSelection = () => {
      const text = window.getSelection().toString().trim();
      if (text) setHighlightedText(text);
    };
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  const now = new Date();

  const getDeckProgress = (deck) => {
    const isKanji = deck.deck_type === "kanji";
    const totalCards = isKanji ? deck.kanji_cards?.length || 0 : deck.vocab_cards?.length || 0;
    if (totalCards === 0) return { total: 0, done: 0, due: 0, percentage: 0 };

    const cardIds = isKanji ? deck.kanji_cards.map(c => c.id) : deck.vocab_cards.map(c => c.id);
    const relevant = srsProgress.filter(p =>
      isKanji ? cardIds.includes(p.kanji_card_id) : cardIds.includes(p.vocab_card_id)
    );
    const done = relevant.filter(p => new Date(p.next_review) > now).length;
    const reviewedIds = new Set(relevant.map(p => isKanji ? p.kanji_card_id : p.vocab_card_id));
    const neverReviewed = cardIds.filter(id => !reviewedIds.has(id)).length;
    const pastDue = relevant.filter(p => new Date(p.next_review) <= now).length;
    const due = neverReviewed + pastDue;

    return { total: totalCards, done, due, percentage: Math.round((done / totalCards) * 100) };
  };

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

  const SkeletonCard = () => (
    <div className="bg-slate-200 dark:bg-slate-800/50 rounded-3xl p-6 animate-pulse min-h-50 flex flex-col justify-between">
      <div>
        <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded-full w-16 mb-4" />
        <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded-full w-3/4 mb-2" />
        <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded-full w-1/2" />
      </div>
      <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-xl mt-4" />
    </div>
  );

  const chatContext = activeLesson
    ? `a reading lesson: "${activeLesson.title}"`
    : activeDeckId
      ? `a ${activeTab === 'kanji' ? 'kanji' : 'vocabulary'} deck`
      : activeTab === 'lessons' ? 'reading lessons'
      : activeTab === 'vocab' ? 'vocabulary'
      : activeTab === 'kanji' ? 'kanji'
      : activeTab === 'verbs' ? 'verb conjugations'
      : null;

  const handleGoBack = () => {
    if (activeLesson) setActiveLesson(null);
    else if (activeDeckId) setActiveDeckId(null);
  };

  const isInSubView = !!(activeLesson || activeDeckId);

  // Sidebar nav items — icon separate from label so icon shows when collapsed
  const navItems = [
    { id: "home",      icon: "🏠", label: "Home" },
    { id: "lessons",   icon: "📖", label: "Reading Modules" },
    { id: "vocab",     icon: "🗂️", label: "Vocab Decks" },
    { id: "kanji",     icon: "✍️", label: "Kanji Decks" },
    { id: "verbs",     icon: "動",  label: "Verb Deck", isKanji: true },
    { id: "immersion", icon: "🎧", label: "Native Immersion" },
    { id: "studio",    icon: "✨", label: "Content Studio" },
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    // If currently in a sub-view, return to library first
    setActiveLesson(null);
    setActiveDeckId(null);
    setReviewSession(null);
    // On phones the sidebar is an overlay — close it after navigating
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // Mobile: sidebar slides in as an overlay. Desktop: collapses to icon rail.
  const sidebarCls = isSidebarOpen
    ? "translate-x-0 w-56"
    : "-translate-x-full w-56 md:translate-x-0 md:w-14";
  const contentML = isSidebarOpen ? "ml-0 md:ml-56" : "ml-0 md:ml-14";

  let mainContent;
  if (reviewSession) {
    mainContent = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <ReviewSession
          mode={reviewSession}
          onClose={() => {
            setReviewSession(null);
            setRefreshKey(k => k + 1);
          }}
        />
      </div>
    );
  } else if (activeLesson) {
    mainContent = <StudyModule lessonData={activeLesson.content_data} onBack={() => setActiveLesson(null)} />;
  } else if (activeDeckId) {
    const activeDeck = [...vocabDecks, ...kanjiDecks].find((d) => d.id === activeDeckId);
    if (activeDeck?.deck_type === "kanji") {
      mainContent = <KanjiDeck deckId={activeDeckId} onBack={() => setActiveDeckId(null)} />;
    } else {
      mainContent = <VocabDeck deckId={activeDeckId} onBack={() => setActiveDeckId(null)} />;
    }
  } else if (loading) {
    mainContent = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  } else {
    mainContent = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-12 font-sans">
        <div className="max-w-6xl mx-auto">
          {["lessons", "vocab", "kanji", "verbs", "immersion"].includes(activeTab) && (
            <header className="mb-10 relative">
              <span className="absolute -top-3 left-0 text-[11px] font-japanese font-bold text-indigo-400 dark:text-indigo-500 tracking-[0.4em]">
                としょかん
              </span>
              <h1 className="font-display text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2 pt-3">
                My Study Library
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                Master your Japanese reading, vocab, kanji, and verbs.
              </p>
              <div className="mt-4 h-0.5 w-16 rounded-full bg-indigo-500/70" />
            </header>
          )}

          {activeTab === "home" && (
            <Dashboard
              vocabDecks={vocabDecks}
              kanjiDecks={kanjiDecks}
              lessons={lessons}
              srsProgress={srsProgress}
              onStartSession={() => setReviewSession({ scope: "global" })}
              onNavigate={handleNavClick}
            />
          )}

          {activeTab === "studio" && (
            <ContentStudio onUploaded={() => setRefreshKey(k => k + 1)} />
          )}

          {activeTab === "immersion" && <ImmersionGateway />}

          {activeTab === "lessons" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.map((lesson, idx) => (
                <button
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  className="group text-left bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full"
                >
                  <div className="mb-4">
                    <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                      Module {idx + 1}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">
                    {lesson.title}
                  </h2>
                  <h3 className="text-sm font-japanese text-slate-500 dark:text-slate-400 mb-6">
                    {lesson.content_data.topic_japanese}
                  </h3>
                </button>
              ))}
            </div>
          )}

          {activeTab === "verbs" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">
                  Verb Deck
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Verbs collected from your reading sessions.
                </p>
              </div>
              <VerbDeck />
            </div>
          )}

          {(activeTab === "vocab" || activeTab === "kanji") && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === "vocab" ? vocabDecks : kanjiDecks).map((deck, idx) => {
                const progress = getDeckProgress(deck);
                return (
                  <button
                    key={deck.id}
                    onClick={() => setActiveDeckId(deck.id)}
                    className="group text-left bg-slate-800 dark:bg-slate-800 text-white p-6 rounded-3xl border border-slate-700 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-500/60 transition-all flex flex-col justify-between h-full relative overflow-hidden min-h-50"
                  >
                    {/* rising-sun accent */}
                    <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-indigo-600/20 group-hover:bg-indigo-600/35 transition-colors" />
                    <div className="relative z-10 mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-slate-700 dark:bg-slate-600 text-slate-300 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                          Deck {idx + 1}
                        </span>
                        {progress.due > 0 && (
                          <span className="bg-orange-500 text-white px-2.5 py-1 rounded-full text-xs font-black">
                            {progress.due} due
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1 leading-tight">{deck.title}</h2>
                      <p className="text-sm text-slate-400">Level: {deck.jlpt_level}</p>
                    </div>
                    <div className="relative z-10 pt-4 border-t border-slate-700 dark:border-slate-600">
                      <ProgressDial progress={progress} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-slate-50 dark:bg-slate-900">

      {/* ── Fixed Top Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="h-full px-3 flex items-center gap-3">

          {/* Sidebar hamburger toggle */}
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Brand mark */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-japanese font-bold text-sm leading-none">学</span>
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-display font-bold text-[15px] text-slate-800 dark:text-slate-100 tracking-tight">Nihongo Sensei</span>
              <span className="text-[9px] font-japanese text-slate-400 tracking-[0.3em] mt-0.5">日本語センセイ</span>
            </div>
          </div>

          {/* Back to Library — only in sub-views */}
          {isInSubView && (
            <button
              onClick={handleGoBack}
              className="ml-2 flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-sm transition-colors whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden md:inline">Back to Library</span>
              <span className="md:hidden">Back</span>
            </button>
          )}

          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button
            onClick={() => setIsDarkMode(prev => !prev)}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

        </div>
      </header>

      {/* Mobile backdrop when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 top-14 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Collapsible Left Sidebar ── */}
      <aside
        className={`fixed top-14 left-0 bottom-0 z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden ${sidebarCls}`}
      >
        {/* Section label — only when open */}
        <div className="px-3 pt-5 pb-2">
          <span className={`text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
            メニュー · Menu
          </span>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={!isSidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all group ${
                  isActive
                    ? item.id === "verbs"
                      ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                      : "bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {/* Icon — always visible */}
                <span
                  className={`flex-shrink-0 w-5 text-center leading-none ${item.isKanji ? "text-base font-black" : "text-lg"}`}
                >
                  {item.icon}
                </span>

                {/* Label — visible only when sidebar is open */}
                <span className="text-sm truncate whitespace-nowrap">
                  {item.label}
                </span>

                {/* Active indicator dot */}
                {isActive && isSidebarOpen && (
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.id === "verbs" ? "bg-teal-500" : "bg-indigo-500"}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom divider spacer */}
        <div className="pb-4" />
      </aside>

      {/* ── Main Content ── */}
      <div className={`pt-14 transition-[margin-left] duration-300 ${contentML} ${isChatOpen ? "md:mr-105 opacity-90" : "mr-0"}`}>
        {mainContent}
      </div>

      <AiSenseiChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        selectedText={highlightedText}
        context={chatContext}
      />

      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white w-14 h-14 rounded-full shadow-xl shadow-indigo-600/30 flex items-center justify-center transition-all z-40"
          title="Ask Sensei"
        >
          <div className="font-display font-black text-base tracking-widest">先生</div>
        </button>
      )}
    </div>
  );
}
