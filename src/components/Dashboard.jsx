import React from 'react';
import { getStreak, streakIsAlive } from '../utils/srs';

// Gradients follow traditional Japanese colors: matcha → asagi → fuji → kin → beni
const LEVELS = [
  { id: 'N5', tagline: 'Foundations', color: 'from-teal-400 to-teal-600' },
  { id: 'N4', tagline: 'Everyday Japanese', color: 'from-sky-400 to-sky-600' },
  { id: 'N3', tagline: 'Bridge to fluency', color: 'from-violet-400 to-violet-600' },
  { id: 'N2', tagline: 'Native media', color: 'from-amber-400 to-orange-500' },
  { id: 'N1', tagline: 'Mastery', color: 'from-indigo-500 to-indigo-700' },
];

// Japanese cloud (kumo) line-art accent
function Kumo({ className }) {
  return (
    <svg viewBox="0 0 140 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}>
      <path d="M14 36c0-10 8-18 18-18 7 0 13 4 16 9" />
      <path d="M50 27c2-8 10-14 19-12 8 1 13 8 12 16" />
      <path d="M6 36h100" />
      <path d="M106 36c8 0 14-6 14-13 0-5-4-9-9-9-4 0-7 3-7 7 0 3 2 5 5 5" />
    </svg>
  );
}

export default function Dashboard({ vocabDecks, kanjiDecks, lessons, srsProgress, onStartSession, onNavigate }) {
  const now = new Date();
  const allDecks = [...vocabDecks, ...kanjiDecks];

  // due + learned across all decks
  const reviewedMap = new Map(); // cardKey -> next_review
  srsProgress.forEach(p => {
    if (p.vocab_card_id) reviewedMap.set(`v${p.vocab_card_id}`, p.next_review);
    if (p.kanji_card_id) reviewedMap.set(`k${p.kanji_card_id}`, p.next_review);
  });

  const levelStats = {};
  LEVELS.forEach(l => { levelStats[l.id] = { total: 0, learned: 0, due: 0, decks: 0 }; });

  allDecks.forEach(deck => {
    const lvl = levelStats[deck.jlpt_level] ? deck.jlpt_level : 'N5';
    const isKanji = deck.deck_type === 'kanji';
    const cards = (isKanji ? deck.kanji_cards : deck.vocab_cards) || [];
    levelStats[lvl].decks += 1;
    levelStats[lvl].total += cards.length;
    cards.forEach(c => {
      const nr = reviewedMap.get(`${isKanji ? 'k' : 'v'}${c.id}`);
      if (nr && new Date(nr) > now) levelStats[lvl].learned += 1;
      else levelStats[lvl].due += 1;
    });
  });

  const totalDue = Object.values(levelStats).reduce((s, l) => s + l.due, 0);
  const sessionSize = Math.min(totalDue, 20);
  const estMins = Math.max(1, Math.round(sessionSize * 20 / 60));
  const streak = getStreak().count;
  const alive = streakIsAlive();

  const quickLinks = [
    { tab: 'lessons', icon: '📖', label: 'Reading', sub: `${lessons.length} lessons` },
    { tab: 'vocab', icon: '🗂️', label: 'Vocab', sub: `${vocabDecks.length} decks` },
    { tab: 'kanji', icon: '✍️', label: 'Kanji', sub: `${kanjiDecks.length} decks` },
    { tab: 'verbs', icon: '動', label: 'Verbs', sub: 'your collection' },
    { tab: 'immersion', icon: '🎧', label: 'Immersion', sub: 'YT · Netflix' },
    { tab: 'studio', icon: '✨', label: 'Add Content', sub: 'AI-powered' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Greeting + streak */}
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">
            おかえりなさい！
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {totalDue > 0 ? 'A small session today keeps the forgetting curve away.' : 'Nothing due — perfect time for immersion or new content.'}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-black ${
          alive && streak > 0
            ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
        }`}>
          <span className="text-xl">🔥</span>
          <span>{alive ? streak : 0} day{(alive ? streak : 0) === 1 ? '' : 's'}</span>
        </div>
      </header>

      {/* Today's session hero — sakura sky (light) / rising sun over ink (dark) */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-400 dark:from-slate-900 dark:via-[#1d1512] dark:to-[#251316] dark:border dark:border-slate-700 text-white p-6 md:p-9 mb-8 shadow-lg shadow-indigo-600/20 dark:shadow-none">
        {/* seigaiha wash */}
        <div className="absolute inset-0 bg-seigaiha opacity-60 dark:opacity-30" />
        {/* rising sun */}
        <div className="absolute -right-12 -top-20 w-64 h-64 rounded-full bg-white/15 dark:bg-indigo-600/90 animate-[floatSlow_7s_ease-in-out_infinite]" />
        <div className="absolute right-16 top-24 w-16 h-16 rounded-full bg-white/10 dark:bg-indigo-500/30" />
        {/* kumo clouds */}
        <Kumo className="absolute right-4 top-8 w-32 text-white/70 dark:text-slate-100/80 animate-[floatSlow_9s_ease-in-out_infinite]" />
        <Kumo className="absolute right-40 -bottom-3 w-24 text-white/40 dark:text-slate-100/40 rotate-2" />
        <div className="absolute right-24 top-16 hidden md:block font-display font-black text-5xl text-white/20 dark:text-white/25 select-none">学</div>

        {totalDue > 0 ? (
          <>
            <p className="relative text-indigo-100 dark:text-indigo-300 text-xs font-black uppercase tracking-[0.25em] mb-2">今日の練習 · Today's session</p>
            <h2 className="relative font-display text-3xl md:text-4xl font-black mb-1">{sessionSize} cards · ~{estMins} min</h2>
            <p className="relative text-indigo-100 dark:text-slate-300 text-sm font-medium mb-6 max-w-md">
              {totalDue > sessionSize ? `${totalDue} due in total — we'll serve them in small rounds.` : 'That’s everything due today.'}
            </p>
            <button
              onClick={onStartSession}
              className="relative px-8 py-3.5 rounded-full bg-white text-indigo-700 dark:bg-indigo-600 dark:text-white font-black hover:scale-[1.03] active:scale-95 transition-all shadow-md"
            >
              ▶ Start review
            </button>
          </>
        ) : (
          <>
            <p className="relative text-indigo-100 dark:text-indigo-300 text-xs font-black uppercase tracking-[0.25em] mb-2">復習 · Reviews</p>
            <h2 className="relative font-display text-3xl md:text-4xl font-black mb-1">All caught up! 🎉</h2>
            <p className="relative text-indigo-100 dark:text-slate-300 text-sm font-medium">Come back tomorrow, or add a new deck in the Content Studio.</p>
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {quickLinks.map(q => (
          <button
            key={q.tab}
            onClick={() => onNavigate(q.tab)}
            className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="text-2xl mb-2">{q.icon}</div>
            <div className="text-sm font-black text-slate-800 dark:text-slate-100">{q.label}</div>
            <div className="text-[11px] text-slate-400 font-medium">{q.sub}</div>
          </button>
        ))}
      </div>

      {/* JLPT path */}
      <h3 className="font-display text-lg font-black text-slate-800 dark:text-slate-100 mb-4">
        Your JLPT path <span className="font-japanese text-xs text-slate-400 font-bold tracking-[0.3em] ml-2">みち</span>
      </h3>
      <div className="space-y-3">
        {LEVELS.map((lvl) => {
          const s = levelStats[lvl.id];
          const hasContent = s.total > 0;
          const pct = hasContent ? Math.round((s.learned / s.total) * 100) : 0;
          return (
            <div
              key={lvl.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                hasContent
                  ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-700 opacity-70'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${lvl.color} flex items-center justify-center text-white font-black shrink-0 ${!hasContent && 'grayscale opacity-60'}`}>
                {lvl.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-black text-slate-800 dark:text-slate-100">{lvl.tagline}</span>
                  {hasContent ? (
                    <span className="text-xs text-slate-400 font-bold">{s.learned}/{s.total} cards learned · {s.decks} decks</span>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium italic">No content yet — add it when you get here</span>
                  )}
                </div>
                {hasContent && (
                  <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${lvl.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              {hasContent ? (
                <span className="text-sm font-black text-slate-500 dark:text-slate-400 shrink-0">{pct}%</span>
              ) : (
                <button
                  onClick={() => onNavigate('studio')}
                  className="text-xs font-bold text-indigo-500 hover:text-indigo-600 shrink-0 whitespace-nowrap"
                >
                  + Add content
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
