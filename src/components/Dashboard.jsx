import React from 'react';
import { getStreak, streakIsAlive } from '../utils/srs';

const LEVELS = [
  { id: 'N5', tagline: 'Foundations', color: 'from-emerald-500 to-teal-500' },
  { id: 'N4', tagline: 'Everyday Japanese', color: 'from-sky-500 to-indigo-500' },
  { id: 'N3', tagline: 'Bridge to fluency', color: 'from-indigo-500 to-violet-500' },
  { id: 'N2', tagline: 'Native media', color: 'from-violet-500 to-fuchsia-500' },
  { id: 'N1', tagline: 'Mastery', color: 'from-fuchsia-500 to-rose-500' },
];

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
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">
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

      {/* Today's session hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 text-white p-8 mb-8 shadow-lg">
        <div className="absolute -right-6 -top-8 text-[120px] opacity-10 font-japanese font-black select-none">学</div>
        {totalDue > 0 ? (
          <>
            <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-2">Today's bite-sized session</p>
            <h2 className="text-3xl font-black mb-1">{sessionSize} cards · ~{estMins} min</h2>
            <p className="text-indigo-200 text-sm font-medium mb-6">
              {totalDue > sessionSize ? `${totalDue} due in total — we'll serve them in small rounds.` : 'That’s everything due today.'}
            </p>
            <button
              onClick={onStartSession}
              className="px-8 py-3.5 rounded-2xl bg-white text-indigo-700 font-black hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 transition-all shadow-md"
            >
              ▶ Start review
            </button>
          </>
        ) : (
          <>
            <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-2">Reviews</p>
            <h2 className="text-3xl font-black mb-1">All caught up! 🎉</h2>
            <p className="text-indigo-200 text-sm font-medium">Come back tomorrow, or add a new deck in the Content Studio.</p>
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
      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">Your JLPT path</h3>
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
