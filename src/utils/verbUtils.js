import { supabase } from '../supabaseClient';
import { getTokenizer, loadDictionary } from './kuromojiManager';

const VERB_TYPE_MAP = {
  '五段動詞': 'u-verb',
  '一段動詞': 'ru-verb',
  'カ行変格活用': 'irregular (くる)',
  'サ行変格活用': 'irregular (する)',
};

const INFLECTION_MAP = {
  '基本形': 'dictionary form',
  '連用形': 'conjunctive (ます-stem)',
  '未然形': 'negative stem',
  '命令形': 'imperative',
  '仮定形': 'conditional (ば)',
  '体言接続': 'noun modifier',
  '連用タ接続': 'past/て base',
  'ガル接続': '-garu connecting',
};

function convertToHiragana(str) {
  if (!str) return '';
  return str.replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
}

export function getVerbType(conjugatedType) {
  return VERB_TYPE_MAP[conjugatedType] || 'verb';
}

export function getInflectionLabel(conjugatedForm) {
  return INFLECTION_MAP[conjugatedForm] || conjugatedForm || '';
}

export function getPlainFormReading(basicForm) {
  const tok = getTokenizer();
  if (!tok || !basicForm) return '';
  return tok.tokenize(basicForm).map((t) => convertToHiragana(t.reading || t.surface_form)).join('');
}

// Strip {kanji|reading} furigana markup from sentence strings
export function stripFurigana(text) {
  return text?.replace(/\{([^|]+)\|[^}]+\}/g, '$1') || '';
}

export async function extractVerbsFromText(selectedText) {
  if (!selectedText) return [];

  let tok = getTokenizer();
  if (!tok) {
    try { tok = await loadDictionary(); } catch { return []; }
  }

  const seen = new Set();
  return tok
    .tokenize(selectedText)
    .filter((t) => t.pos === '動詞')
    .reduce((acc, t) => {
      if (!seen.has(t.basic_form)) {
        seen.add(t.basic_form);
        acc.push({
          plain_form: t.basic_form,
          reading_hiragana: getPlainFormReading(t.basic_form),
          verb_type: getVerbType(t.conjugated_type),
          inflected_form: t.surface_form,
          inflection_label: getInflectionLabel(t.conjugated_form),
          meaning_hinglish: '',
        });
      }
      return acc;
    }, []);
}

function extractJson(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
  } catch {}
  return null;
}

export async function fetchVerbMeanings(plainForms) {
  if (!plainForms.length) return {};

  const prompt = `You are a Japanese dictionary. For each verb, provide a short English meaning (2-5 words, starting with "to").
Verbs: ${plainForms.join('、')}
Reply ONLY with valid JSON like: {"食べる":"to eat","飲む":"to drink"}`;

  // Try Claude Haiku first
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
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = extractJson(data.content[0].text);
        if (parsed) return parsed;
      }
    } catch {}
  }

  // Fallback: Groq
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = extractJson(data.choices[0].message.content);
        if (parsed) return parsed;
      }
    } catch {}
  }

  return {};
}

export async function addVerbToSupabase(verb, sourceSentence) {
  const { data: existing } = await supabase
    .from('verb_cards')
    .select('id')
    .eq('plain_form', verb.plain_form)
    .maybeSingle();

  if (existing) return { status: 'duplicate' };

  const { error } = await supabase.from('verb_cards').insert({
    plain_form: verb.plain_form,
    reading_hiragana: verb.reading_hiragana || null,
    meaning_hinglish: verb.meaning_hinglish || null,
    verb_type: verb.verb_type || null,
    inflected_form: verb.inflected_form || null,
    inflection_label: verb.inflection_label || null,
    source_sentence: stripFurigana(sourceSentence) || null,
  });

  return error ? { status: 'error', error } : { status: 'success' };
}
