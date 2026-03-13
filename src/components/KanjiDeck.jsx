// src/components/KanjiDeck.jsx
import React, { useState, useEffect } from 'react';
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
        <rt className="text-[10px] text-slate-400 font-normal pb-0.5 select-none">{match[2]}</rt>
      </ruby>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) elements.push(text.substring(lastIndex));
  return elements;
};

export default function KanjiDeck({ deckId, onBack }) {
  const [deckData, setDeckData] = useState(null);
  const [srsData, setSrsData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!deckId) return;
      setLoading(true);
      
      const { data: deck } = await supabase
        .from('decks')
        .select(`*, kanji_cards (*)`)
        .eq('id', deckId)
        .single();

      if (deck) {
        setDeckData(deck);
        const cardIds = deck.kanji_cards.map(c => c.id);
        if (cardIds.length > 0) {
          const { data: srs } = await supabase
            .from('srs_progress')
            .select('*')
            .in('kanji_card_id', cardIds);
            
          const srsMap = {};
          srs?.forEach(record => {
            if (new Date(record.next_review) > new Date()) {
              srsMap[record.kanji_card_id] = true;
            }
          });
          setSrsData(srsMap);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [deckId]);

  const toggleDone = async (cardId) => {
    const isCurrentlyDone = srsData[cardId];
    setSrsData(prev => ({ ...prev, [cardId]: !isCurrentlyDone }));

    if (isCurrentlyDone) {
      await supabase.from('srs_progress')
        .update({ next_review: new Date().toISOString() })
        .eq('kanji_card_id', cardId);
    } else {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      
      await supabase.from('srs_progress').upsert({
        kanji_card_id: cardId,
        next_review: futureDate.toISOString()
      }, { onConflict: 'kanji_card_id' });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-indigo-600 animate-pulse text-2xl">Loading Kanji Deck...</div>;
  if (!deckData) return <div className="p-10 text-center">Deck not found.</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Library
      </button>

      <header className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">{deckData.title}</h1>
        <div className="mt-4 inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
          {deckData.kanji_cards?.length || 0} Kanji
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {deckData.kanji_cards?.map((item) => {
          const isDone = srsData[item.id];
          return (
            <div key={item.id} className={`relative rounded-3xl border transition-all duration-300 flex flex-col ${isDone ? 'bg-slate-50/50 border-green-200 shadow-none opacity-75' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
              
              <button 
                onClick={() => toggleDone(item.id)}
                className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isDone ? 'bg-green-500 text-white' : 'bg-slate-700/30 hover:bg-slate-700/50 text-white'}`}
                title="Mark as learned for 48 hours"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>

              <div className={`p-6 text-white flex justify-between items-center rounded-t-3xl transition-colors ${isDone ? 'bg-slate-500' : 'bg-slate-800'}`}>
                <div className="flex flex-col pr-8">
                  <span className="text-5xl font-black font-japanese mb-2 leading-none">{item.kanji_character}</span>
                  <div className="flex gap-3 text-[10px] tracking-widest uppercase font-bold text-slate-300">
                    <span>{item.onyomi}</span>
                    <span>•</span>
                    <span>{item.kunyomi}</span>
                  </div>
                </div>
                <span className="text-xl font-black text-indigo-200 capitalize text-right leading-tight">{item.meaning_hinglish}</span>
              </div>

              <div className="p-6 grow space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Vocabulary Context</h3>
                {item.usage_examples?.map((ex, exIdx) => (
                  <div key={exIdx} className={`relative pl-4 border-l-2 ${isDone ? 'border-slate-200' : 'border-indigo-100'}`}>
                    <span className={`absolute -left-2.25 top-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${isDone ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>{exIdx + 1}</span>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-lg font-bold font-japanese">
                        {ex.compound_word} <span className="text-xs font-normal text-slate-400 ml-1">({ex.reading_hiragana})</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-600">{ex.meaning_hinglish}</span>
                    </div>
                    {ex.example_sentence && (
                      <div className={`p-3 rounded-xl border ${isDone ? 'bg-slate-100 border-slate-100' : 'bg-indigo-50/50 border-indigo-50/80'}`}>
                        <p className="text-sm font-japanese text-slate-800 mb-1 leading-relaxed">
                          {parseFuriganaString(ex.example_sentence)}
                        </p>
                        <p className="text-xs text-slate-500 italic">{ex.sentence_meaning}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}