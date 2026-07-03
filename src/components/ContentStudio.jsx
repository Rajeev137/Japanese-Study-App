import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { generateVocabCards, generateKanjiCards, generateReadingLesson } from '../utils/aiClient';
import { parseFuriganaString } from '../utils/furigana.jsx';

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const BATCH_SIZE = 8; // words per AI call — keeps output reliable

const TYPE_META = {
  vocab: {
    label: 'Vocab Deck', icon: '🗂️',
    placeholder: `Paste your raw list, one word per line, e.g.\n\n1. think, consider [kangaemasu]\n2. arrive (at the station) [(eki ni) tsukimasu]\n3. study abroad [ryūgakushimasu]`,
    hint: 'AI writes the kanji, furigana reading and 2 example sentences with grammar notes for every word.',
  },
  kanji: {
    label: 'Kanji Deck', icon: '✍️',
    placeholder: `Paste kanji, one per line (meaning hints optional), e.g.\n\n考\n駅 station\n田舎 countryside`,
    hint: 'AI adds onyomi/kunyomi, meanings and 2 compound-word examples with sentences per kanji.',
  },
  reading: {
    label: 'Reading Lesson', icon: '📖',
    placeholder: `Paste any Japanese paragraph or story here.\n\n私は毎朝七時に起きます。朝ごはんを食べてから、大学へ行きます。…`,
    hint: 'AI cleans the text, translates it, and extracts key vocabulary + grammar points as a full lesson.',
  },
};

export default function ContentStudio({ onUploaded }) {
  const [type, setType] = useState('vocab');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('N5');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(null); // progress message
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // generated cards / lesson
  const [uploadedMsg, setUploadedMsg] = useState(null);

  const meta = TYPE_META[type];

  const switchType = (t) => {
    setType(t);
    setPreview(null);
    setError(null);
    setUploadedMsg(null);
  };

  const handleGenerate = async () => {
    setError(null);
    setUploadedMsg(null);
    setPreview(null);
    if (!raw.trim()) { setError('Paste some content first.'); return; }

    try {
      if (type === 'reading') {
        setBusy('Sensei is building your lesson… (~30s)');
        const lesson = await generateReadingLesson(raw.trim(), level, title.trim() || null);
        if (!lesson) throw new Error('AI returned invalid JSON — try Generate again.');
        setPreview(lesson);
      } else {
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        const batches = [];
        for (let i = 0; i < lines.length; i += BATCH_SIZE) {
          batches.push(lines.slice(i, i + BATCH_SIZE));
        }
        const all = [];
        for (let i = 0; i < batches.length; i++) {
          setBusy(`Generating cards… batch ${i + 1} of ${batches.length}`);
          const gen = type === 'vocab'
            ? await generateVocabCards(batches[i].join('\n'), level)
            : await generateKanjiCards(batches[i].join('\n'), level);
          if (!gen) throw new Error(`Batch ${i + 1} returned invalid JSON — try Generate again.`);
          all.push(...gen);
        }
        setPreview(all);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const removeCard = (idx) => {
    setPreview(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    setError(null);
    setBusy('Uploading to your database…');
    try {
      if (type === 'reading') {
        const { error: e } = await supabase.from('essays').insert({
          title: preview.topic_english || title.trim() || 'Reading Lesson',
          content_data: preview,
        });
        if (e) throw new Error(e.message);
      } else {
        const { data: newDeck, error: de } = await supabase
          .from('decks')
          .insert({
            title: title.trim() || `${meta.label} ${new Date().toLocaleDateString()}`,
            jlpt_level: level,
            deck_type: type,
            is_system_deck: true,
          })
          .select()
          .single();
        if (de) throw new Error(de.message);

        const rows = type === 'vocab'
          ? preview.map(c => ({
              deck_id: newDeck.id,
              word_kanji: c.word_kanji,
              reading_hiragana: c.reading_furigana || c.reading_hiragana || c.word_kanji,
              meaning_hinglish: c.meaning_english || c.meaning_hinglish,
              jlpt_level: level,
              usage_details: { examples: c.examples || [] },
            }))
          : preview.map(c => ({
              deck_id: newDeck.id,
              kanji_character: c.kanji_character,
              onyomi: c.onyomi,
              kunyomi: c.kunyomi,
              meaning_hinglish: c.meaning_hinglish,
              usage_examples: c.usage_examples || [],
            }));

        const table = type === 'vocab' ? 'vocab_cards' : 'kanji_cards';
        const { error: ce } = await supabase.from(table).insert(rows);
        if (ce) throw new Error(ce.message);
      }
      setUploadedMsg(type === 'reading'
        ? '✅ Lesson uploaded! Find it under Reading Modules.'
        : `✅ Deck uploaded with ${preview.length} cards! Find it under ${meta.label}s.`);
      setPreview(null);
      setRaw('');
      setTitle('');
      onUploaded?.();
    } catch (e) {
      setError(`Upload failed: ${e.message}. You can Copy JSON below and use the seed script instead.`);
    } finally {
      setBusy(null);
    }
  };

  const copyJson = () => {
    const payload = type === 'reading'
      ? preview
      : { deck_title: title || meta.label, jlpt_level: level, [type === 'vocab' ? 'vocabulary' : 'kanji']: preview };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setUploadedMsg('📋 JSON copied to clipboard.');
  };

  const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">Content Studio</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Paste raw material → Sensei structures it → one click into your database.
        </p>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(TYPE_META).map(([t, m]) => (
          <button
            key={t}
            onClick={() => switchType(t)}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              type === t
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Input form */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-4">
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={type === 'reading' ? 'Lesson title (optional — AI can name it)' : 'Deck title, e.g. "Minna Lesson 25 Vocab"'}
            className={inputCls + ' flex-1'}
          />
          <select value={level} onChange={e => setLevel(e.target.value)} className={inputCls + ' sm:w-28'}>
            {JLPT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={meta.placeholder}
          rows={9}
          className={inputCls + ' font-japanese resize-y leading-relaxed'}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">{meta.hint}</p>

        <button
          onClick={handleGenerate}
          disabled={!!busy}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold transition-colors"
        >
          {busy || '✨ Generate with AI'}
        </button>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium">
            {error}
          </div>
        )}
        {uploadedMsg && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm font-bold">
            {uploadedMsg}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
              Preview {Array.isArray(preview) ? `· ${preview.length} cards` : ''}
            </h3>
            <div className="flex gap-2">
              <button onClick={copyJson} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                Copy JSON
              </button>
              <button
                onClick={handleUpload}
                disabled={!!busy}
                className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-bold transition-colors"
              >
                {busy || '⬆️ Upload to Database'}
              </button>
            </div>
          </div>

          {type === 'reading' ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
              <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{preview.topic_english}</h4>
              <p className="font-japanese text-slate-500 dark:text-slate-400">{preview.topic_japanese}</p>
              <p className="font-japanese text-slate-700 dark:text-slate-200 whitespace-pre-line text-sm max-h-48 overflow-y-auto">{preview.full_essay_japanese}</p>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                {preview.vocabulary_list?.length || 0} vocab words · {preview.grammar_points?.length || 0} grammar points extracted
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview.map((card, idx) => (
                <div key={idx} className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                  <button
                    onClick={() => removeCard(idx)}
                    title="Remove this card"
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 hover:text-red-500 text-xs font-black transition-colors"
                  >
                    ✕
                  </button>
                  {type === 'vocab' ? (
                    <>
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="text-2xl font-japanese font-bold text-slate-800 dark:text-slate-100">{card.word_kanji}</span>
                        <span className="text-sm text-slate-400">{card.reading_furigana || card.reading_hiragana}</span>
                      </div>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-3">{card.meaning_english || card.meaning_hinglish}</p>
                      {card.examples?.map((ex, i) => (
                        <p key={i} className="text-sm font-japanese text-slate-600 dark:text-slate-300 leading-[2.2] mb-1">
                          {parseFuriganaString(ex.japanese_sentence)}
                        </p>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="text-3xl font-japanese font-bold text-slate-800 dark:text-slate-100">{card.kanji_character}</span>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{card.meaning_hinglish}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">音: {card.onyomi} · 訓: {card.kunyomi}</p>
                      {card.usage_examples?.map((ex, i) => (
                        <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
                          <span className="font-japanese font-bold">{ex.compound_word}</span>
                          <span className="text-slate-400"> ({ex.reading_hiragana})</span> — {ex.meaning_hinglish}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
