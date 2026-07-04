import { createClient } from '@supabase/supabase-js';

// Server-only client — uses the service role key, which must never be
// exposed to the browser (that's why this lives in api/, not src/).
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { type, title, level, preview } = req.body || {};

  try {
    if (type === 'reading') {
      const { error } = await supabase.from('essays').insert({
        title: preview?.topic_english || title || 'Reading Lesson',
        content_data: preview,
      });
      if (error) throw error;
    } else if (type === 'vocab' || type === 'kanji') {
      const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
          title: title || `${type} deck ${new Date().toLocaleDateString()}`,
          jlpt_level: level,
          deck_type: type,
          is_system_deck: true,
        })
        .select()
        .single();
      if (deckError) throw deckError;

      const rows = type === 'vocab'
        ? preview.map((c) => ({
            deck_id: newDeck.id,
            word_kanji: c.word_kanji,
            reading_hiragana: c.reading_furigana || c.reading_hiragana || c.word_kanji,
            meaning_hinglish: c.meaning_english || c.meaning_hinglish,
            jlpt_level: level,
            usage_details: { examples: c.examples || [] },
          }))
        : preview.map((c) => ({
            deck_id: newDeck.id,
            kanji_character: c.kanji_character,
            onyomi: c.onyomi,
            kunyomi: c.kunyomi,
            meaning_hinglish: c.meaning_hinglish,
            usage_examples: c.usage_examples || [],
          }));

      const table = type === 'vocab' ? 'vocab_cards' : 'kanji_cards';
      const { error: cardsError } = await supabase.from(table).insert(rows);
      if (cardsError) throw cardsError;
    } else {
      res.status(400).json({ error: `Unknown content type: ${type}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
