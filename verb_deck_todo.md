# Verb Deck Feature — Setup Guide & Documentation

## Feature Overview

The Verb Deck lets you build a personal collection of Japanese verbs encountered while studying. When studying any Japanese sentence — in a Reading Module, Vocab Deck, or Kanji Deck — select (highlight) any text, and the app automatically detects verbs using Kuromoji, fetches their English meaning via Claude/Groq, and lets you add them to your Verb Deck with one click.

---

## How It Works (End-to-End Flow)

### 1. Verb Detection (works in all 3 study modes)

- **Reading Module**: select text in any Japanese paragraph.
- **Vocab Deck**: select text in any example sentence inside a vocab card.
- **Kanji Deck**: select text in any example sentence inside a kanji card.
- On mouse-up, the app tokenizes the selected text with Kuromoji and filters for `pos === '動詞'` (verb) tokens.
- A **Verbs Detected** panel opens inside that card, listing each unique verb found.

### 2. What the Panel Shows

For each detected verb:

| Field | Source | Description |
|-------|--------|-------------|
| **Plain form** | Kuromoji `basic_form` | The dictionary/infinitive form (e.g., 食べる) |
| **Reading** | Re-tokenising `basic_form` via cached tokeniser | Hiragana reading of the plain form (e.g., たべる) |
| **Meaning** | Claude Haiku → Groq fallback (async) | English meaning fetched from AI (e.g., "to eat") |
| **Verb type** | Kuromoji `conjugated_type` | u-verb / ru-verb / irregular (くる) / irregular (する) |
| **Inflected form** | Kuromoji `surface_form` | How it appeared in the sentence (e.g., 食べている) |
| **Inflection label** | Kuromoji `conjugated_form` | English name of the grammatical form (e.g., "conjunctive (ます-stem)") |

While meanings are loading a "fetching meanings…" indicator appears. The meaning is auto-populated before user clicks Add, so the saved card has the English translation.

### 3. Adding to the Deck

Clicking **+ Add** on a verb:
1. Checks `verb_cards` for an existing row with the same `plain_form` (duplicate guard).
2. If duplicate → amber toast "Already in your Verb Deck".
3. If new → inserts row (with meaning) → teal toast "Added 食べる to Verb Deck!".

### 4. Verb Deck Tab

The **動 Verb Deck** tab shows all collected verbs, most recently added first. Each card:
- Header (teal): plain form with reading (furigana) + meaning + verb type badge
- Body: inflected form as seen + inflection label + source sentence snippet
- Footer: "Remove from deck" button

No SRS algorithm applied yet — collection/reference view only.

---

## Supabase Setup — SQL to Run

> **Have you already run the original CREATE TABLE from a previous version?**
> Check Step 1a vs Step 1b below.

---

### Step 1a — Fresh setup (table does NOT exist yet)

```sql
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

ALTER TABLE public.verb_cards
  ADD CONSTRAINT verb_cards_plain_form_unique UNIQUE (plain_form);

COMMENT ON TABLE public.verb_cards IS
  'Verbs collected by the user during study sessions.';
```

---

### Step 1b — Migration (table already exists with `inflection_type` column)

The original CREATE TABLE used `inflection_type` but the code uses `inflection_label`. Run this to fix the mismatch:

```sql
ALTER TABLE public.verb_cards
  RENAME COLUMN inflection_type TO inflection_label;
```

---

### Step 2 — Enable RLS

```sql
ALTER TABLE public.verb_cards ENABLE ROW LEVEL SECURITY;
```

---

### Step 3 — RLS Policies

```sql
CREATE POLICY "anon_select_verb_cards"
  ON public.verb_cards FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_verb_cards"
  ON public.verb_cards FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_verb_cards"
  ON public.verb_cards FOR DELETE TO anon USING (true);
```

> **Production note:** Once you add Supabase Auth, add `user_id UUID REFERENCES auth.users` column and change `USING (true)` to `USING (auth.uid() = user_id)` on INSERT and DELETE policies.

---

### Step 4 — Verify

Go to Table Editor in Supabase and confirm:
- `verb_cards` appears with columns: `id`, `plain_form`, `reading_hiragana`, `meaning_hinglish`, `verb_type`, `inflected_form`, `inflection_label`, `source_sentence`, `created_at`
- Shield icon shows RLS is enabled
- Three policies visible under Auth → Policies

---

## No New Tables Needed

The `meaning_hinglish` column already exists in the original schema. The English meaning is fetched from the AI at selection time and saved inline — no extra table or migration needed for this feature.

---

## Future Work (SRS Integration)

1. **Add a `verb_srs_progress` table** (same pattern as `srs_progress` but with `verb_card_id` FK).
2. **Run SM-2** on verb cards the same way VocabDeck and KanjiDeck do.
3. **Conjugation quizzing**: show plain form, ask user to type a specific form (て-form, ない-form), verify with Kuromoji.
4. **Per-user rows**: add `user_id` column and auth-based RLS when Supabase Auth is integrated.

---

## Files Changed on This Branch (`feature/verb-deck`)

| File | Change |
|------|--------|
| `src/utils/kuromojiManager.js` | Added `getTokenizer()` export |
| `src/utils/verbUtils.js` | **New** — shared verb extraction, meaning fetch (Claude/Groq), Supabase insert |
| `src/components/VerbPanel.jsx` | **New** — shared "Verbs Detected" panel + VerbToast components |
| `src/components/VerbDeck.jsx` | **New** — Verb Deck viewer (teal theme, no SRS) |
| `src/components/StudyModule.jsx` | Verb detection on text selection, now uses shared utils |
| `src/components/VocabDeck.jsx` | Verb detection on example sentences |
| `src/components/KanjiDeck.jsx` | Verb detection on example sentences |
| `src/App.jsx` | Added "動 Verb Deck" tab, imported VerbDeck |
| `verb_deck_todo.md` | This file |
| `PROJECT_CONTEXT.md` | General project overview |
