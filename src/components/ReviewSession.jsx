import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { parseFuriganaString } from '../utils/furigana.jsx';
import { sm2, daysFromNow, isDue, bumpStreak } from '../utils/srs';

const SESSION_CAP = 20; // bite-sized: never show more than this per round

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One-card-at-a-time SRS session.
 * mode: { scope: 'deck', deckId, deckType: 'vocab'|'kanji' } | { scope: 'global' }
 */
export default function ReviewSession({ mode, onClose }) {
  const [queue, setQueue] = useState(null); // [{card, type, record}]
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ again: 0, hard: 0, easy: 0 });
  const [startTime] = useState(() => Date.now());
  const [endTime, setEndTime] = useState(null);

  useEffect(() => {
    async function load() {
      const now = new Date();
      let cards = []; // {card, type}

      if (mode.scope === 'deck') {
        const table = mode.deckType === 'kanji' ? 'kanji_cards' : 'vocab_cards';
        const { data } = await supabase.from(table).select('*').eq('deck_id', mode.deckId);
        cards = (data || []).map(c => ({ card: c, type: mode.deckType }));
      } else {
        const [{ data: v }, { data: k }] = await Promise.all([
          supabase.from('vocab_cards').select('*'),
          supabase.from('kanji_cards').select('*'),
        ]);
        cards = [
          ...(v || []).map(c => ({ card: c, type: 'vocab' })),
          ...(k || []).map(c => ({ card: c, type: 'kanji' })),
        ];
      }

      const { data: srs } = await supabase.from('srs_progress').select('*');
      const srsMap = {};
      srs?.forEach(r => {
        if (r.vocab_card_id) srsMap[`vocab_${r.vocab_card_id}`] = r;
        if (r.kanji_card_id) srsMap[`kanji_${r.kanji_card_id}`] = r;
      });

      const due = cards
        .map(c => ({ ...c, record: srsMap[`${c.type}_${c.card.id}`] }))
        .filter(c => isDue(c.record, now));

      setQueue(shuffle(due).slice(0, SESSION_CAP));
    }
    load();
  }, [mode]);

  const current = queue?.[idx];
  const done = queue && idx >= queue.length;
  const reviewedCount = results.again + results.hard + results.easy;

  const rate = useCallback(async (quality) => {
    if (!current) return;
    const rec = current.record;
    const { nextIntervalDays, nextEaseFactor } = sm2(
      quality, rec?.interval_days ?? 1, rec?.ease_factor ?? 2.5, rec?.review_count ?? 0,
    );
    const key = quality === 1 ? 'again' : quality === 3 ? 'hard' : 'easy';
    setResults(prev => ({ ...prev, [key]: prev[key] + 1 }));
    setFlipped(false);
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    if (nextIdx >= queue.length) {
      setEndTime(Date.now());
      bumpStreak();
    }

    const idCol = current.type === 'kanji' ? 'kanji_card_id' : 'vocab_card_id';
    await supabase.from('srs_progress').upsert({
      [idCol]: current.card.id,
      next_review: daysFromNow(nextIntervalDays),
      interval_days: nextIntervalDays,
      ease_factor: nextEaseFactor,
      review_count: (rec?.review_count ?? 0) + 1,
    }, { onConflict: idCol });
  }, [current, idx, queue]);

  // Keyboard: space/enter = flip, 1/2/3 = rate
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!current) return;
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setFlipped(true); }
      else if (flipped) {
        if (e.key === '1') rate(1);
        else if (e.key === '2') rate(3);
        else if (e.key === '3') rate(5);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, current, rate]);

  // ---- Loading ----
  if (!queue) {
    return (
      <SessionShell onClose={() => onClose(0)}>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-bold text-sm">Preparing your session…</p>
        </div>
      </SessionShell>
    );
  }

  // ---- Nothing due ----
  if (queue.length === 0) {
    return (
      <SessionShell onClose={() => onClose(0)}>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-display text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">All caught up!</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">No cards due right now. Go enjoy some immersion instead.</p>
          <button onClick={() => onClose(0)} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors">
            Back
          </button>
        </div>
      </SessionShell>
    );
  }

  // ---- Summary ----
  if (done) {
    const mins = Math.max(1, Math.round(((endTime ?? startTime) - startTime) / 60000));
    return (
      <SessionShell onClose={() => onClose(reviewedCount)}>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="font-display text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">Session complete!</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
            {reviewedCount} cards in {mins} min. お疲れ様でした！
          </p>
          <div className="flex justify-center gap-4 mb-10">
            <Stat label="Again" value={results.again} color="text-red-500" />
            <Stat label="Hard" value={results.hard} color="text-amber-500" />
            <Stat label="Easy" value={results.easy} color="text-green-500" />
          </div>
          <button onClick={() => onClose(reviewedCount)} className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors">
            Done
          </button>
        </div>
      </SessionShell>
    );
  }

  // ---- Active card ----
  const { card, type } = current;
  const pct = Math.round((idx / queue.length) * 100);

  return (
    <SessionShell onClose={() => onClose(reviewedCount)}>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-black text-slate-400 whitespace-nowrap">{idx + 1} / {queue.length}</span>
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-lg p-8 min-h-[320px] flex flex-col">
        <span className="self-start text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 mb-6">
          {type === 'kanji' ? 'Kanji' : 'Vocab'}
        </span>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl md:text-6xl font-japanese font-bold text-slate-800 dark:text-slate-100 mb-4" style={{ lineHeight: 1.4 }}>
            {type === 'kanji' ? card.kanji_character : card.word_kanji}
          </div>

          {!flipped ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Recall the reading and meaning…</p>
          ) : (
            <div className="w-full space-y-4 animate-[fadeIn_.25s_ease]">
              {type === 'kanji' ? (
                <>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">音 {card.onyomi} · 訓 {card.kunyomi}</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{card.meaning_hinglish}</p>
                  <div className="text-left max-w-md mx-auto space-y-2">
                    {card.usage_examples?.slice(0, 2).map((ex, i) => (
                      <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-japanese font-bold">{ex.compound_word}</span>
                        <span className="text-slate-400"> ({ex.reading_hiragana})</span> — {ex.meaning_hinglish}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-lg text-slate-500 dark:text-slate-400 font-japanese">{card.reading_hiragana}</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 capitalize">{card.meaning_hinglish}</p>
                  {card.usage_details?.examples?.[0] && (
                    <div className="text-left max-w-md mx-auto">
                      <p className="text-base font-japanese text-slate-700 dark:text-slate-200 leading-[2.4]">
                        {parseFuriganaString(card.usage_details.examples[0].japanese_sentence)}
                      </p>
                      <p className="text-xs text-slate-400 italic">{card.usage_details.examples[0].english_translation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="w-full py-4 rounded-2xl bg-slate-800 dark:bg-slate-700 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-white font-bold transition-colors"
          >
            Show answer <span className="opacity-50 text-xs ml-2">space</span>
          </button>
        ) : (
          <div className="flex gap-3">
            <RateBtn onClick={() => rate(1)} label="Again" kbd="1" cls="bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400" />
            <RateBtn onClick={() => rate(3)} label="Hard" kbd="2" cls="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400" />
            <RateBtn onClick={() => rate(5)} label="Easy" kbd="3" cls="bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 text-green-700 dark:text-green-400" />
          </div>
        )}
      </div>
    </SessionShell>
  );
}

function SessionShell({ children, onClose }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-end mb-2">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold transition-colors"
        >
          ✕ End session
        </button>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="text-center px-4">
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</div>
    </div>
  );
}

function RateBtn({ onClick, label, kbd, cls }) {
  return (
    <button onClick={onClick} className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${cls}`}>
      {label} <span className="opacity-40 text-xs ml-1">{kbd}</span>
    </button>
  );
}
