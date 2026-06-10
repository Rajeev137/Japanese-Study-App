import React from 'react';

export function VerbToast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all ${
        toast.type === 'warning'
          ? 'bg-amber-500 text-white'
          : toast.type === 'error'
          ? 'bg-red-500 text-white'
          : 'bg-teal-700 text-white'
      }`}
    >
      {toast.msg}
    </div>
  );
}

export default function VerbPanel({ verbPopover, isFetchingMeanings, onAdd, onClose }) {
  if (!verbPopover?.verbs?.length) return null;

  return (
    <div className="mt-4 border-t border-teal-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">
          Verbs Detected
        </span>
        <div className="flex items-center gap-2">
          {isFetchingMeanings && (
            <span className="text-[10px] text-slate-400 animate-pulse">fetching meanings…</span>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {verbPopover.verbs.map((v, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ruby className="text-xl font-bold font-japanese text-teal-900">
                  {v.plain_form}
                  {v.reading_hiragana && (
                    <rt className="text-[10px] text-teal-500 font-normal">
                      {v.reading_hiragana}
                    </rt>
                  )}
                </ruby>
                <span className="text-[10px] font-black bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {v.verb_type}
                </span>
                {v.meaning_hinglish && (
                  <span className="text-xs text-slate-600 font-medium italic">
                    {v.meaning_hinglish}
                  </span>
                )}
              </div>
              {v.inflected_form && v.inflected_form !== v.plain_form && (
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-japanese">{v.inflected_form}</span>
                  {v.inflection_label && ` · ${v.inflection_label}`}
                </p>
              )}
            </div>
            <button
              onClick={() => onAdd(v, verbPopover.sourceSentence)}
              disabled={isFetchingMeanings}
              className={`ml-3 shrink-0 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                isFetchingMeanings
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              {isFetchingMeanings ? '…' : '+ Add'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
