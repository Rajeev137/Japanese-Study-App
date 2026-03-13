import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Initialize Supabase with the Service Role Key
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase URL or Service Key in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateLessons() {
  console.log('🚀 Starting Lesson (Essay) Migration...');
  const lessonsDir = path.join(__dirname, 'src', 'data', 'lessons');
  
  if (!fs.existsSync(lessonsDir)) {
    console.log('⚠️ No lessons folder found. Skipping...');
    return;
  }

  const files = fs.readdirSync(lessonsDir).filter(file => file.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(lessonsDir, file);
    const essayJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Insert into 'essays' table
    const { error } = await supabase
      .from('essays')
      .insert({
        title: essayJson.topic_english || file.replace('.json', ''), 
        content_data: essayJson, 
        user_id: null, 
        deck_id: null
      });

    if (error) {
      console.error(`❌ Error uploading lesson ${file}:`, error.message);
    } else {
      console.log(`✅ Uploaded lesson: ${essayJson.topic_english || file}`);
    }
  }
}

async function migrateVocabDecks() {
  console.log('\n🚀 Starting Vocab Deck Migration...');
  const decksDir = path.join(__dirname, 'src', 'data', 'vocab');

  if (!fs.existsSync(decksDir)) {
    console.log('⚠️ No vocab folder found. Skipping...');
    return;
  }

  const files = fs.readdirSync(decksDir).filter(file => file.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(decksDir, file);
    const deckJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const deckTitle = deckJson.deck_title || deckJson.title || file.replace('.json', '');

    const { data: newDeck, error: deckError } = await supabase
      .from('decks')
      .insert({
        title: deckTitle,
        jlpt_level: deckJson.jlpt_level || 'N5',
        is_system_deck: true
      })
      .select()
      .single();

    if (deckError) {
      console.error(`❌ Error creating deck for ${file}:`, deckError.message);
      continue; 
    }

    console.log(`📁 Created Deck: ${newDeck.title}`);

    const cardsArray = deckJson.vocabulary || deckJson.cards || [];

    if (cardsArray.length === 0) {
      console.log(`⚠️ No vocab words found in ${file}. Skipping card insert.`);
      continue;
    }

    const vocabInserts = cardsArray.map(card => ({
      deck_id: newDeck.id,
      word_kanji: card.word_kanji, 
      reading_hiragana: card.reading_furigana || card.reading_hiragana || card.word_kanji, 
      meaning_hinglish: card.meaning_english || card.meaning_hinglish,   
      jlpt_level: newDeck.jlpt_level,
      usage_details: {
        examples: card.examples || [] 
      }
    }));

    const { error: vocabError } = await supabase
      .from('vocab_cards')
      .insert(vocabInserts);

    if (vocabError) {
      console.error(`❌ Error uploading vocab for ${newDeck.title}:`, vocabError.message);
    } else {
      console.log(`✅ Uploaded ${vocabInserts.length} vocab cards for ${newDeck.title}`);
    }
  }
}

async function run() {
  await migrateLessons();
  await migrateVocabDecks();
  console.log('\n🎉 Database Seed Complete! Check your Supabase Dashboard.');
}

run();