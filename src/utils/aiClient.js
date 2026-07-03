// Shared AI caller: Claude Haiku → Groq → OpenRouter fallback chain.
// Used by Content Studio to convert raw pasted material into DB-ready JSON.

export function extractJson(text) {
  if (!text) return null;
  // strip markdown fences if present
  const cleaned = text.replace(/```json|```/g, '');
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch { /* try next bracket type */ }
    }
  }
  return null;
}

export async function callAI(prompt, { system, maxTokens = 4096 } = {}) {
  const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (claudeKey && claudeKey !== 'your-claude-api-key-here') {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content[0].text;
      }
    } catch { /* fall through */ }
  }

  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }
    } catch { /* fall through */ }
  }

  const orKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (orKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${orKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }
    } catch { /* fall through */ }
  }

  throw new Error('All AI providers failed. Check your API keys in .env');
}

// ---- Content generation prompts (match the Supabase schemas exactly) ----

const VOCAB_SYSTEM = `You are a Japanese teaching-content generator for a JLPT study app. You output ONLY valid JSON, no commentary.`;

export async function generateVocabCards(rawLines, jlptLevel) {
  const prompt = `Convert this raw vocabulary list into structured JSON flashcards for a ${jlptLevel} student.

RAW LIST (format is roughly "meaning [romaji or kana]", one word per line):
${rawLines}

Output a JSON array. One object per word:
{
  "word_kanji": "the word in standard Japanese script (kanji where natural at ${jlptLevel}, kana otherwise)",
  "reading_furigana": "full hiragana reading",
  "meaning_english": "the English meaning from the list",
  "examples": [
    {
      "japanese_sentence": "natural ${jlptLevel}-level sentence using the word. Wrap EVERY kanji word as {kanji|furigana}, e.g. {考|かんが}えます",
      "english_translation": "English translation",
      "grammar_explanation": "one-sentence note on the key grammar pattern used"
    },
    { ...a second, different example... }
  ]
}

Rules:
- Exactly 2 examples per word, using grammar a ${jlptLevel} student knows.
- Furigana markup {kanji|reading} must cover every kanji in example sentences.
- Output ONLY the JSON array.`;

  const text = await callAI(prompt, { system: VOCAB_SYSTEM, maxTokens: 8000 });
  return extractJson(text);
}

export async function generateKanjiCards(rawLines, jlptLevel) {
  const prompt = `Convert this raw kanji list into structured JSON flashcards for a ${jlptLevel} student.

RAW LIST (one kanji per line, possibly with meaning hints):
${rawLines}

Output a JSON array. One object per kanji:
{
  "kanji_character": "the single kanji",
  "onyomi": "on-readings in katakana, comma separated",
  "kunyomi": "kun-readings in hiragana, comma separated",
  "meaning_hinglish": "English meaning(s)",
  "usage_examples": [
    {
      "compound_word": "common ${jlptLevel} word using this kanji",
      "reading_hiragana": "reading of that word",
      "meaning_hinglish": "meaning of that word",
      "example_sentence": "short natural ${jlptLevel} sentence using the compound word",
      "sentence_meaning": "English translation of the sentence"
    },
    { ...a second example with a different compound... }
  ]
}

Rules: exactly 2 usage_examples per kanji. Output ONLY the JSON array.`;

  const text = await callAI(prompt, { system: VOCAB_SYSTEM, maxTokens: 8000 });
  return extractJson(text);
}

export async function generateReadingLesson(rawText, jlptLevel, titleHint) {
  const prompt = `Turn this Japanese text into a structured reading lesson for a ${jlptLevel} student.

SOURCE TEXT:
${rawText}

Output ONE JSON object:
{
  "topic_english": "${titleHint || 'short English title for the text'}",
  "topic_japanese": "Japanese title",
  "full_essay_japanese": "the full Japanese text, cleaned up, paragraphs separated by \\n\\n. Keep the original wording; only fix obvious typos.",
  "full_essay_hinglish": "natural English translation, same paragraph breaks (\\n\\n)",
  "vocabulary_list": [
    { "word_kanji": "key word from the text", "reading_hiragana": "reading", "meaning_hinglish": "meaning" }
    // 8-15 of the most useful words for a ${jlptLevel} learner
  ],
  "grammar_points": [
    { "level": "${jlptLevel}", "grammar_structure": "pattern e.g. ～てから", "explanation_hinglish": "clear 1-2 sentence explanation of how it's used in this text" }
    // 4-8 key grammar patterns that appear in the text; set "level" to the actual JLPT level of each pattern (N5/N4/...)
  ]
}

Output ONLY the JSON object.`;

  const text = await callAI(prompt, { system: VOCAB_SYSTEM, maxTokens: 8000 });
  return extractJson(text);
}
