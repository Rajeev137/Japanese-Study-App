# Japanese Sensei App — Project Context

## What This Is

A personal Japanese study web app built with React + Vite + Tailwind CSS v4, backed by Supabase. It combines reading practice, vocabulary drilling, kanji study, and verb collection into one interface. An AI chat assistant (Sensei) is always available via a sidebar.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4 |
| Database | Supabase (Postgres + RLS) |
| Japanese NLP | Kuromoji (browser-side tokenizer, dictionary served from `/public/dict`) |
| AI Chat | Claude Haiku 4.5 (primary) → Groq llama-3.3-70b (fallback) → OpenRouter qwen-2.5 (fallback) |
| Hosting | Vercel |

---

## Navigation Model

Tab-based, no React Router. `App.jsx` holds `activeTab` (persisted to localStorage). Tabs:

| Tab key | What shows |
|---------|-----------|
| `immersion` | ImmersionGateway — YouTube/Netflix links |
| `lessons` | Grid of essay cards → click opens StudyModule |
| `vocab` | Grid of vocab decks → click opens VocabDeck |
| `kanji` | Grid of kanji decks → click opens KanjiDeck |
| `verbs` | VerbDeck (one unified collection, no deck grid) |

---

## Supabase Tables

### `essays`
Reading lessons. Key field: `content_data` (JSONB) containing:
- `full_essay_japanese` — newline-separated paragraphs
- `full_essay_hinglish` — parallel translation
- `vocabulary_list[]` — words highlighted in the reader
- `grammar_points[]` — JLPT-tagged grammar shown in Grammar Masterlist

### `decks`
Parent table for vocab and kanji decks. Field `deck_type`: `"vocab"` or `"kanji"`.

### `vocab_cards`
FK to `decks`. Fields: `word_kanji`, `reading_hiragana`, `meaning_hinglish`, `usage_details` (JSONB with `examples[]` containing `japanese_sentence`, `english_translation`, `grammar_explanation`).

### `kanji_cards`
FK to `decks`. Fields: `kanji_character`, `onyomi`, `kunyomi`, `meaning_hinglish`, `usage_examples[]` (JSONB with `compound_word`, `reading_hiragana`, `meaning_hinglish`, `example_sentence`, `sentence_meaning`).

### `srs_progress`
SRS state for vocab and kanji cards. Fields: `vocab_card_id` or `kanji_card_id`, `next_review`, `interval_days`, `ease_factor`, `review_count`. Unique constraint per card ID column.

### `verb_cards`
User-collected verbs. Fields: `plain_form` (unique), `reading_hiragana`, `meaning_hinglish`, `verb_type`, `inflected_form`, `inflection_label`, `source_sentence`, `created_at`. No SRS yet.

---

## Key Source Files

| File | Role |
|------|------|
| `src/App.jsx` | Root: tab routing, library data fetch, progress dials |
| `src/components/StudyModule.jsx` | Reading lesson viewer: Kuromoji furigana, speech, pronunciation scoring, verb extraction |
| `src/components/VocabDeck.jsx` | Vocab card grid with SM-2 SRS + verb extraction on sentences |
| `src/components/KanjiDeck.jsx` | Kanji card grid with SM-2 SRS + verb extraction on sentences |
| `src/components/VerbDeck.jsx` | Verb collection viewer (no SRS, teal theme) |
| `src/components/VerbPanel.jsx` | Shared "Verbs Detected" panel + VerbToast components |
| `src/components/AiSenseiChat.jsx` | Streaming AI sidebar: Claude → Groq → OpenRouter fallback chain |
| `src/components/ImmersionGateway.jsx` | Links to immersion content |
| `src/utils/kuromojiManager.js` | Singleton tokenizer loader with request queue |
| `src/utils/verbUtils.js` | Shared verb logic: extraction, meaning fetch (AI), Supabase add |
| `src/utils/furigana.jsx` | `parseFuriganaString()` — parses `{kanji|reading}` markup to `<ruby>` |
| `src/supabaseClient.js` | Supabase client (uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |

---

## Environment Variables (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLAUDE_API_KEY=
VITE_GROQ_API_KEY=
VITE_OPENROUTER_API_KEY=
```

---

## SRS Algorithm (SM-2)

Implemented in VocabDeck and KanjiDeck. On each review the user rates: **Again (1)** / **Hard (3)** / **Easy (5)**.

- Again → reset interval to 1 day
- First review → 1 day; second review → 3 days
- Subsequent → `interval × ease_factor` (ease min 1.3)
- Ease formula: `ease + 0.1 - (5 - quality) × 0.08`

Progress dials in the deck grid show `done / total` (done = reviewed AND `next_review > now`).

---

## Verb Extraction Flow

1. User selects text in any Japanese sentence (Reading Module paragraph, Vocab/Kanji example sentence).
2. Kuromoji tokenizes the selection; tokens with `pos === '動詞'` are extracted.
3. For each unique verb: plain form (`basic_form`), reading (re-tokenize plain form), type (`conjugated_type`), inflected form (`surface_form`), inflection label (`conjugated_form`).
4. AI call (Claude Haiku → Groq) fetches English meanings for all verbs in one batch request.
5. User clicks **+ Add** → `addVerbToSupabase()` checks for duplicate, then inserts to `verb_cards`.

---

## Active Branch

`feature/verb-deck` — adds VerbDeck and verb extraction to all study modes. See `verb_deck_todo.md` for Supabase SQL to run before merging.
