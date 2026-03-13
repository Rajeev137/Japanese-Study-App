// src/components/VocabDeck.jsx
import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient';

const parseFuriganaString = (text) => {
  if (!text) return null;
  const regex = /\{([^|]+)\|([^}]+)\}/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    elements.push(
      <ruby key={match.index} className="mx-px text-slate-800">
        {match[1]}
        <rt className="text-[10px] text-slate-400 font-normal pb-0.5 select-none">
          {match[2]}
        </rt>
      </ruby>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  return elements;
};

export default function VocabDeck({ deckId, onBack }) {
  const [deckData, setDeckData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeckFromCloud() {
      if (!deckId) return;
      setLoading(true);
      
      const { data, error } = await supabase
        .from('decks')
        .select(`
          *,
          vocab_cards (*)
        `)
        .eq('id', deckId)
        .single();

      if (error) {
        console.error("❌ Error fetching deck details:", error);
      } else {
        setDeckData(data);
      }
      setLoading(false);
    }

    fetchDeckFromCloud();
  }, [deckId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-indigo-600 animate-pulse text-2xl">
      ☁️ Loading Deck Content...
    </div>
  );

  if (!deckData) return <div className="p-10 text-center">Deck not found.</div>;

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
        <div className="mt-4 inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
          {deckData.vocab_cards?.length || 0} Words
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {deckData.vocab_cards?.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <ruby className="text-3xl font-japanese font-bold tracking-widest">
                {item.word_kanji}
                <rt className="text-[11px] text-slate-300 font-normal tracking-normal pb-1">
                  {item.reading_hiragana}
                </rt>
              </ruby>
              <span className="text-xl font-black text-indigo-300 capitalize">{item.meaning_hinglish}</span>
            </div>

            <div className="p-6 grow space-y-6">
              {item.usage_details?.examples?.map((ex, exIdx) => (
                <div key={exIdx} className="relative pl-4 border-l-2 border-indigo-100">
                  <span className="absolute -left-2.25 top-1 bg-indigo-100 text-indigo-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black">{exIdx + 1}</span>
                  <p className="text-xl font-japanese text-slate-800 mb-2 leading-[2.5]">
                    {parseFuriganaString(ex.japanese_sentence)}
                  </p>
                  <p className="text-sm text-slate-500 italic mb-3">{ex.english_translation}</p>
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-50/80">
                    <p className="text-xs text-indigo-900 leading-relaxed">{ex.grammar_explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}