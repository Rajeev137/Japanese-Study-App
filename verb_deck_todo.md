# Verb Deck Feature — Setup Guide & Documentation

## Feature Overview

The Verb Deck lets you build a personal collection of Japanese verbs encountered while reading lessons. When studying a passage in the Reading Module, you can select any sentence, instantly see the verbs Kuromoji detects in that selection (with their plain/dictionary form and grammatical information), and add them to your Verb Deck with one click.

---

## How It Works (End-to-End Flow)

### 1. Verb Detection During Reading

- Open any Reading Module lesson.
- Select (highlight) a Japanese sentence or phrase in the paragraph card.
- On mouse-up, the app scans the Kuromoji tokenization of that paragraph for any tokens whose `pos` field is `動詞` (verb) and whose `surface_form` appears in your selection.
- A **Verbs Detected** panel slides open inside the paragraph card, listing each unique verb found.

### 2. What the Panel Shows

For each detected verb:

| Field | Source | Description |
|-------|--------|-------------|
| **Plain form** | Kuromoji `basic_form` | The dictionary/infinitive form (e.g., 食べる) |
| **Reading** | Re-tokenising `basic_form` via cached tokeniser | Hiragana reading of the plain form (e.g., たべる) |
| **Verb type** | Kuromoji `conjugated_type` | u-verb / ru-verb / irregular (くる) / irregular (する) |
| **Inflected form** | Kuromoji `surface_form` | How it appeared in the sentence (e.g., 食べている) |
| **Inflection label** | Kuromoji `conjugated_form` | English name of the grammatical form (e.g., "conjunctive (ます-stem)") |

### 3. Adding to the Deck

Clicking **+ Add** on a verb:
1. Checks `verb_cards` for an existing row with the same `plain_form`.
2. If found → shows amber toast "Already in your Verb Deck".
3. If not found → inserts a new row and shows teal toast "Added 食べる to Verb Deck!".

### 4. Verb Deck Tab

The **動 Verb Deck** tab in the navigation shows all collected verbs, most recently added first. Each card displays:
- Header (teal): plain form with reading (furigana) + meaning (if available) + verb type badge
- Body: inflected form as seen in context + inflection label + source sentence snippet
- Footer: "Remove from deck" button (permanently deletes the row)

No SRS algorithm is applied yet — the deck is a reference/collection view only.

---

## Supabase Setup — TODO Checklist

### Step 1: Create the `verb_cards` table

Run the following SQL in the **Supabase SQL Editor** (Database → SQL Editor → New query):

```sql
-- Create verb_cards table
CREATE TABLE public.verb_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plain_form       TEXT NOT NULL,
  reading_hiragana TEXT,
  meaning_hinglish TEXT,
  verb_type        TEXT,
  inflected_form   TEXT,
  inflection_label TEXT,
  source_sentence  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate verbs (same plain form added twice)
ALTER TABLE public.verb_cards
  ADD CONSTRAINT verb_cards_plain_form_unique UNIQUE (plain_form);

-- Descriptive comment
COMMENT ON TABLE public.verb_cards IS
  'Verbs collected by the user during Reading Module sessions.';
```

### Step 2: Enable Row-Level Security (RLS)

```sql
-- Enable RLS (blocks all access until policies are added)
ALTER TABLE public.verb_cards ENABLE ROW LEVEL SECURITY;
```

### Step 3: Add RLS Policies

The app uses the **anon key** (public, unauthenticated). Until you add user auth, grant the anon role full CRUD so the app works. Lock this down to per-user rows once you add Supabase Auth.

```sql
-- Allow anon to read all verb cards
CREATE POLICY "anon_select_verb_cards"
  ON public.verb_cards
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to insert new verb cards
CREATE POLICY "anon_insert_verb_cards"
  ON public.verb_cards
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to delete verb cards
CREATE POLICY "anon_delete_verb_cards"
  ON public.verb_cards
  FOR DELETE
  TO anon
  USING (true);
```

> **Note:** These policies allow any visitor to read/write the table. Once you add Supabase Auth (e.g., `auth.uid()`), replace `true` with `auth.uid() = user_id` and add a `user_id UUID REFERENCES auth.users` column. That's the correct production setup.

### Step 4: Verify

After running the SQL above, go to **Table Editor** in Supabase and confirm:
- `verb_cards` table appears with all columns
- The shield icon on the table shows RLS is enabled
- Policies for SELECT, INSERT, DELETE are listed under Auth → Policies

---

## Future Work (SRS Integration)

When you're ready to add SRS review to the Verb Deck:

1. **Add a `verb_srs_progress` table** (similar to `srs_progress` but with `verb_card_id` foreign key).
2. **Run SM-2** on the verb cards the same way VocabDeck and KanjiDeck do.
3. **Add conjugation quizzing**: show the plain form, ask the user to type a specific conjugated form (e.g., て-form, ない-form), check with kuromoji.
4. **Meaning field**: currently the deck stores verbs without English meaning. The Claude Sensei chat already knows the lesson context — you could auto-call the API on add to fill in `meaning_hinglish`.

---

## Files Changed on This Branch (`feature/verb-deck`)

| File | Change |
|------|--------|
| `src/utils/kuromojiManager.js` | Added `getTokenizer()` export for synchronous cached access |
| `src/components/StudyModule.jsx` | Verb extraction on text selection + Verbs Detected panel + toast |
| `src/components/VerbDeck.jsx` | **New** — Verb Deck viewer component |
| `src/App.jsx` | Added "動 Verb Deck" tab, imported VerbDeck, updated chat context |
| `verb_deck_todo.md` | This file |
