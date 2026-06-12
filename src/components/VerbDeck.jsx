import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const VERB_TYPE_COLORS = {
  "u-verb": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  "ru-verb": "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
  "irregular (くる)": "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400",
  "irregular (する)": "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400",
};

export default function VerbDeck() {
  const [verbCards, setVerbCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerbs();
  }, []);

  async function fetchVerbs() {
    setLoading(true);
    const { data } = await supabase
      .from("verb_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setVerbCards(data);
    setLoading(false);
  }

  const deleteVerb = async (id) => {
    await supabase.from("verb_cards").delete().eq("id", id);
    setVerbCards((prev) => prev.filter((v) => v.id !== id));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse h-56" />
        ))}
      </div>
    );
  }

  if (verbCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">動</div>
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">No Verbs Yet</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Open a Reading Module, select a sentence, and click{" "}
          <span className="font-bold text-teal-600">+ Add to Verb Deck</span>{" "}
          on any detected verb.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span className="inline-block bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-3 py-1 rounded-full text-sm font-bold">
          {verbCards.length} {verbCards.length === 1 ? "Verb" : "Verbs"} collected
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">SRS review coming soon</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {verbCards.map((card) => {
          const typeColor =
            VERB_TYPE_COLORS[card.verb_type] || "bg-slate-100 text-slate-600";

          return (
            <div
              key={card.id}
              className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-teal-800 p-6 text-white flex justify-between items-start">
                <div>
                  <ruby className="text-3xl font-japanese font-bold tracking-widest">
                    {card.plain_form}
                    {card.reading_hiragana && (
                      <rt className="text-[11px] text-teal-200 font-normal tracking-normal pb-1">
                        {card.reading_hiragana}
                      </rt>
                    )}
                  </ruby>
                  {card.meaning_hinglish && (
                    <p className="text-teal-200 text-sm mt-1 font-medium">
                      {card.meaning_hinglish}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-full mt-1 whitespace-nowrap ${typeColor}`}
                >
                  {card.verb_type || "verb"}
                </span>
              </div>

              {/* Body */}
              <div className="p-5 grow space-y-3">
                {card.inflected_form && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 dark:text-slate-500 text-xs uppercase font-bold tracking-wider">
                      Found as
                    </span>
                    <span className="font-japanese font-semibold text-slate-700 dark:text-slate-200">
                      {card.inflected_form}
                    </span>
                    {card.inflection_label && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                        ({card.inflection_label})
                      </span>
                    )}
                  </div>
                )}

                {card.source_sentence && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Source sentence
                    </p>
                    <p className="text-sm font-japanese text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {card.source_sentence}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => deleteVerb(card.id)}
                  className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-xs font-bold hover:border-red-200 dark:hover:border-red-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Remove from deck
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
