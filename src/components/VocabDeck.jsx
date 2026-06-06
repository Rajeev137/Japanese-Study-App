import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient';
import { parseFuriganaString } from '../utils/furigana';

// SM-2 algorithm: returns { nextIntervalDays, nextEaseFactor }
function sm2(quality, intervalDays, easeFactor, reviewCount) {
  let newInterval;
  let newEase = easeFactor + 0.1 - (5 - quality) * 0.08;
  newEase = Math.max(1.3, newEase);

  if (quality < 3) {
    // Forgot it — reset
    newInterval = 1;
  } else if (reviewCount === 0) {
    newInterval = 1;
  } else if (reviewCount === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(intervalDays * easeFactor);
  }

  return { nextIntervalDays: newInterval, nextEaseFactor: newEase };
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function formatNextReview(isoDate) {
  if (!isoDate) return null;
  const days = Math.round((new Date(isoDate) - new Date()) / 86400000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export default function VocabDeck({ deckId, onBack }) {
  const [deckData, setDeckData] = useState(null);
  const [srsData, setSrsData] = useState({});
  const [flippedCards, setFlippedCards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!deckId) return;
      setLoading(true);

      const { data: deck } = await supabase
        .from('decks')
        .select(`*, vocab_cards (*)`)
        .eq('id', deckId)
        .single();

      if (deck) {
        setDeckData(deck);
        const cardIds = deck.vocab_cards.map(c => c.id);
        if (cardIds.length > 0) {
          const { data: srs } = await supabase
            .from('srs_progress')
            .select('*')
            .in('vocab_card_id', cardIds);

          const srsMap = {};
          srs?.forEach(record => {
            srsMap[record.vocab_card_id] = record;
          });
          setSrsData(srsMap);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [deckId]);

  const flipCard = (cardId) => {
    setFlippedCards(prev => ({ ...prev, [cardId]: true }));
  };

  const rateCard = async (cardId, quality) => {
    const record = srsData[cardId];
    const intervalDays = record?.interval_days ?? 1;
    const easeFactor = record?.ease_factor ?? 2.5;
    const reviewCount = record?.review_count ?? 0;

    const { nextIntervalDays, nextEaseFactor } = sm2(quality, intervalDays, easeFactor, reviewCount);
    const nextReview = daysFromNow(nextIntervalDays);

    // Optimistic update
    setSrsData(prev => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        next_review: nextReview,
        interval_days: nextIntervalDays,
        ease_factor: nextEaseFactor,
        review_count: reviewCount + 1,
      }
    }));
    setFlippedCards(prev => ({ ...prev, [cardId]: false }));

    await supabase.from('srs_progress').upsert({
      vocab_card_id: cardId,
      next_review: nextReview,
      interval_days: nextIntervalDays,
      ease_factor: nextEaseFactor,
      review_count: reviewCount + 1,
    }, { onConflict: 'vocab_card_id' });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-20">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-3xl bg-slate-100 animate-pulse h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!deckData) return <div className="p-10 text-center">Deck not found.</div>;

  const now = new Date();
  const dueCount = deckData.vocab_cards?.filter(c => {
    const rec = srsData[c.id];
    return !rec || new Date(rec.next_review) <= now;
  }).length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Library
      </button>

      <header className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">{deckData.title}</h1>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
            {deckData.vocab_cards?.length || 0} Words
          </span>
          {dueCount > 0 && (
            <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
              {dueCount} due for review
            </span>
          )}
          {dueCount === 0 && deckData.vocab_cards?.length > 0 && (
            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
              All caught up!
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {deckData.vocab_cards?.map((item) => {
          const record = srsData[item.id];
          const isDue = !record || new Date(record.next_review) <= now;
          const isFlipped = flippedCards[item.id];
          const nextReviewLabel = record ? formatNextReview(record.next_review) : null;

          return (
            <div
              key={item.id}
              className={`relative rounded-3xl border transition-all duration-300 flex flex-col ${
                !isDue
                  ? 'bg-slate-50/50 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card header */}
              <div className={`p-6 text-white flex justify-between items-center rounded-t-3xl transition-colors ${!isDue ? 'bg-slate-500' : 'bg-slate-800'}`}>
                <ruby className="text-3xl font-japanese font-bold tracking-widest pr-8">
                  {item.word_kanji}
                  <rt className="text-[11px] text-slate-300 font-normal tracking-normal pb-1">{item.reading_hiragana}</rt>
                </ruby>
                <span className="text-xl font-black text-indigo-200 capitalize text-right leading-tight">{item.meaning_hinglish}</span>
              </div>

              {/* Card body */}
              <div className="p-6 grow space-y-6">
                {item.usage_details?.examples?.map((ex, exIdx) => (
                  <div key={exIdx} className={`relative pl-4 border-l-2 ${!isDue ? 'border-slate-200' : 'border-indigo-100'}`}>
                    <span className={`absolute -left-2.5 top-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${!isDue ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>
                      {exIdx + 1}
                    </span>
                    <p className="text-xl font-japanese text-slate-800 mb-2 leading-[2.5]">
                      {parseFuriganaString(ex.japanese_sentence)}
                    </p>
                    <p className="text-sm text-slate-500 italic mb-3">{ex.english_translation}</p>
                    <div className={`p-3 rounded-xl border ${!isDue ? 'bg-slate-100 border-slate-100' : 'bg-indigo-50/50 border-indigo-50/80'}`}>
                      <p className="text-xs text-slate-600 leading-relaxed">{ex.grammar_explanation}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* SRS footer */}
              <div className="px-6 pb-6">
                {!isDue ? (
                  <div className="text-center text-xs text-slate-400 font-medium py-2">
                    {nextReviewLabel}
                  </div>
                ) : !isFlipped ? (
                  <button
                    onClick={() => flipCard(item.id)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-white text-sm font-bold transition-colors"
                  >
                    I've reviewed this →
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold text-center mb-1">How well did you recall it?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => rateCard(item.id, 1)}
                        className="flex-1 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold transition-colors"
                      >
                        Again
                      </button>
                      <button
                        onClick={() => rateCard(item.id, 3)}
                        className="flex-1 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-bold transition-colors"
                      >
                        Hard
                      </button>
                      <button
                        onClick={() => rateCard(item.id, 5)}
                        className="flex-1 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 text-sm font-bold transition-colors"
                      >
                        Easy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
