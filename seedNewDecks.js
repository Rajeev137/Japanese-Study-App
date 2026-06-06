import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Only seed decks that don't already exist by title
const NEW_DECKS = ['deck18','deck19','deck20','deck21','deck22','deck23','deck24','deck25'];
const DATA_DIR = path.join(__dirname, '..', 'data', 'vocab');

async function run() {
  console.log('Checking existing decks in Supabase...');
  const { data: existing } = await supabase.from('decks').select('title');
  const existingTitles = new Set((existing || []).map(d => d.title));

  for (const deckFile of NEW_DECKS) {
    const filePath = path.join(DATA_DIR, `${deckFile}.json`);
    const deckJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const title = deckJson.deck_title || deckJson.title || deckFile;

    if (existingTitles.has(title)) {
      console.log(`⏭️  Skipping "${title}" — already in database`);
      continue;
    }

    const { data: newDeck, error: deckError } = await supabase
      .from('decks')
      .insert({
        title,
        jlpt_level: deckJson.jlpt_level || 'N5',
        deck_type: 'vocab',
        is_system_deck: true,
      })
      .select()
      .single();

    if (deckError) {
      console.error(`❌ Error creating deck "${title}":`, deckError.message);
      continue;
    }

    console.log(`📁 Created deck: ${newDeck.title}`);

    const cardsArray = deckJson.vocabulary || deckJson.cards || [];
    if (cardsArray.length === 0) {
      console.log(`  ⚠️  No cards found in ${deckFile}.json`);
      continue;
    }

    const vocabInserts = cardsArray.map(card => ({
      deck_id: newDeck.id,
      word_kanji: card.word_kanji,
      reading_hiragana: card.reading_furigana || card.reading_hiragana || card.word_kanji,
      meaning_hinglish: card.meaning_english || card.meaning_hinglish,
      jlpt_level: newDeck.jlpt_level,
      usage_details: { examples: card.examples || [] },
    }));

    const { error: cardError } = await supabase.from('vocab_cards').insert(vocabInserts);

    if (cardError) {
      console.error(`  ❌ Error inserting cards for "${title}":`, cardError.message);
    } else {
      console.log(`  ✅ Inserted ${vocabInserts.length} cards`);
    }
  }

  console.log('\nDone.');
}

run();
