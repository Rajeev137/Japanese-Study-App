import React, { useEffect, useState, useCallback } from "react";
import { loadDictionary, getTokenizer } from "../utils/kuromojiManager";
import { supabase } from "../supabaseClient";

// --- GLOBAL CACHE (Runs only once, outside the component) ---
let globalTokenizer = null;
let isInitializing = false;
let initializationQueue = [];

const convertToHiragana = (katakanaStr) => {
  if (!katakanaStr) return "";
  return katakanaStr.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
};

const VERB_TYPE_MAP = {
  "\u4e94\u6bb5\u52d5\u8a5e": "u-verb",
  "\u4e00\u6bb5\u52d5\u8a5e": "ru-verb",
  "\u30ab\u884c\u5909\u683c\u6d3b\u7528": "irregular (\u304f\u308b)",
  "\u30b5\u884c\u5909\u683c\u6d3b\u7528": "irregular (\u3059\u308b)",
};

const INFLECTION_MAP = {
  "\u57fa\u672c\u5f62": "dictionary form",
  "\u9023\u7528\u5f62": "conjunctive (\u307e\u3059-stem)",
  "\u672a\u7136\u5f62": "negative stem",
  "\u547d\u4ee4\u5f62": "imperative",
  "\u4eee\u5b9a\u5f62": "conditional (\u3070)",
  "\u4f53\u8a00\u63a5\u7d9a": "noun modifier",
  "\u9023\u7528\u30bf\u63a5\u7d9a": "past/\u3066 base",
  "\u30ac\u30eb\u63a5\u7d9a": "-garu connecting",
};

function getVerbType(conjugatedType) {
  return VERB_TYPE_MAP[conjugatedType] || "verb";
}

function getInflectionLabel(conjugatedForm) {
  return INFLECTION_MAP[conjugatedForm] || conjugatedForm || "";
}

function getPlainFormReading(basicForm) {
  const tok = getTokenizer();
  if (!tok || !basicForm) return "";
  const tokens = tok.tokenize(basicForm);
  return tokens.map((t) => convertToHiragana(t.reading || t.surface_form)).join("");
}

export default function StudyModule({ lessonData, onBack }) {
  const [tokenizedParagraphs, setTokenizedParagraphs] = useState([]);
  const [isDictLoading, setIsDictLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showFurigana, setShowFurigana] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(null);
  const [isRecording, setIsRecording] = useState(null);
  const [userSpeech, setUserSpeech] = useState({});
  const [verbPopover, setVerbPopover] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setIsDictLoading(true);
    setErrorMessage(null);

    // Give React 100 milliseconds to actually draw the "Loading..." screen
    // before Kuromoji hijacks the CPU to build the massive dictionary.
    setTimeout(() => {
      loadDictionary()
        .then((tokenizer) => {
          const rawText = lessonData?.full_essay_japanese || "";
          const paragraphs = rawText.split("\n\n");

          const parsedParagraphs = paragraphs.map((paragraph) => {
            if (!paragraph.trim()) return [];
            return tokenizer.tokenize(paragraph);
          });

          setTokenizedParagraphs(parsedParagraphs);
          setIsDictLoading(false);
        })
        .catch((error) => {
          setErrorMessage(
            "Network error: Could not load the dictionary. Please refresh.",
          );
          setIsDictLoading(false);
        });
    }, 100);
  }, [lessonData]);

  const toggleSpeech = (text, idx) => {
    if (isSpeaking !== null && isSpeaking !== idx)
      window.speechSynthesis.cancel();
    if (isSpeaking === idx) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.paused
          ? window.speechSynthesis.resume()
          : window.speechSynthesis.pause();
        return;
      }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    utterance.onstart = () => setIsSpeaking(idx);
    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(null);
  };

  const startRecording = (idx) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        "Speech recognition not supported in this browser. Try Chrome on Mac.",
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsRecording(idx);
    recognition.onresult = (event) => {
      setUserSpeech((prev) => ({
        ...prev,
        [idx]: event.results[0][0].transcript,
      }));
    };
    recognition.onend = () => setIsRecording(null);
    recognition.onerror = () => setIsRecording(null);
    recognition.start();
  };

  const getMatchScore = (original, spoken) => {
    if (!spoken) return null;
    const clean = (str) => str.replace(/[、。！？\s]/g, "");
    const o = clean(original);
    const s = clean(spoken);
    if (o === s) return 100;
    let matches = 0;
    for (let char of s) if (o.includes(char)) matches++;
    return Math.round((matches / o.length) * 100);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleParagraphMouseUp = (idx, paraText) => {
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();
    if (!selectedText) {
      setVerbPopover(null);
      return;
    }

    const tokens = tokenizedParagraphs[idx] || [];
    const verbTokens = tokens.filter(
      (t) => t.pos === "動詞" && selectedText.includes(t.surface_form)
    );

    if (verbTokens.length === 0) {
      setVerbPopover(null);
      return;
    }

    const seen = new Set();
    const uniqueVerbs = verbTokens.reduce((acc, t) => {
      if (!seen.has(t.basic_form)) {
        seen.add(t.basic_form);
        acc.push({
          plain_form: t.basic_form,
          reading_hiragana: getPlainFormReading(t.basic_form),
          verb_type: getVerbType(t.conjugated_type),
          inflected_form: t.surface_form,
          inflection_label: getInflectionLabel(t.conjugated_form),
        });
      }
      return acc;
    }, []);

    setVerbPopover({ paragraphIdx: idx, verbs: uniqueVerbs, sourceSentence: paraText });
  };

  const addVerbToDeck = async (verb, sourceSentence) => {
    const { data: existing } = await supabase
      .from("verb_cards")
      .select("id")
      .eq("plain_form", verb.plain_form)
      .maybeSingle();

    if (existing) {
      showToast(`${verb.plain_form} is already in your Verb Deck`, "warning");
      return;
    }

    const { error } = await supabase.from("verb_cards").insert({
      plain_form: verb.plain_form,
      reading_hiragana: verb.reading_hiragana,
      verb_type: verb.verb_type,
      inflected_form: verb.inflected_form,
      inflection_label: verb.inflection_label,
      source_sentence: sourceSentence,
    });

    if (error) {
      showToast("Failed to add verb. Please try again.", "error");
    } else {
      showToast(`Added ${verb.plain_form} to Verb Deck!`);
    }
  };

  const renderToken = (token, index) => {
    if (!token) return null;
    const { surface_form, basic_form, reading } = token;
    const isTargetVocab = lessonData?.vocabulary_list?.find(
      (v) => v.word_kanji === basic_form || v.word_kanji === surface_form,
    );
    const hasKanji = /[\u4e00-\u9faf]/.test(surface_form || "");
    const furiganaText = hasKanji && reading ? convertToHiragana(reading) : null;

    if (hasKanji) {
      return (
        <span key={index} className="group relative inline-block mx-px">
          <ruby className={`ruby-position ${isTargetVocab ? "text-blue-600 font-bold" : "text-slate-700"}`}>
            {surface_form}
            {showFurigana && furiganaText && (
              <rt className="text-[10px] text-slate-400 font-normal select-none">{furiganaText}</rt>
            )}
          </ruby>
          {isTargetVocab && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block w-max max-w-xs bg-gray-900 text-white text-sm rounded-lg p-3 shadow-xl z-50 pointer-events-none">
              <span className="block text-blue-300 text-[10px] font-black uppercase mb-1">{isTargetVocab.jlpt_level}</span>
              <span className="block text-lg font-bold">{isTargetVocab.reading_hiragana}</span>
              <span className="block text-gray-200 mt-1">{isTargetVocab.meaning_hinglish}</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          )}
        </span>
      );
    }
    return <span key={index}>{surface_form}</span>;
  };

  if (errorMessage)
    return <div className="p-8 text-red-500 text-center">{errorMessage}</div>;
  if (isDictLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-indigo-500 animate-pulse">
        Loading ...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Library
      </button>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">
            {lessonData?.topic_english}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            {lessonData?.topic_japanese}
          </p>
        </div>
        <button
          onClick={() => setShowFurigana(!showFurigana)}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${showFurigana ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-white text-indigo-600 border-2 border-indigo-100"}`}
        >
          {showFurigana ? "Reading Mode: ON" : "Reading Mode: OFF"}
        </button>
      </header>

      <div className="space-y-6">
        {(lessonData?.full_essay_japanese?.split("\n\n") || []).map(
          (para, idx) => {
            const hinglishPara =
              lessonData?.full_essay_hinglish?.split("\n\n")[idx];
            return (
              <div
                key={idx}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
              >
                {/* Japanese Card */}
                <div
                  className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors"
                  onMouseUp={() => handleParagraphMouseUp(idx, para)}
                >
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-4">
                    Paragraph {idx + 1}
                  </span>
                  <div className="text-2xl leading-[2.8] text-slate-700 font-japanese mb-6">
                    {tokenizedParagraphs[idx]?.map((token, tokenIdx) =>
                      renderToken(token, tokenIdx),
                    )}
                  </div>

                  {/* Audio & Mic Controls */}
                  <div className="flex items-center gap-2 border-t pt-4">
                    <button
                      onClick={() => toggleSpeech(para, idx)}
                      className={`p-2 rounded-lg transition-all ${isSpeaking === idx ? "bg-indigo-600 text-white" : "bg-slate-100 text-indigo-500 hover:bg-indigo-100"}`}
                    >
                      {isSpeaking === idx && !window.speechSynthesis.paused ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </button>
                    {isSpeaking === idx && (
                      <button
                        onClick={stopSpeech}
                        className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => startRecording(idx)}
                      className={`p-2 rounded-lg transition-all ml-auto ${isRecording === idx ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500"}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </svg>
                    </button>
                  </div>

                  {/* User Feedback */}
                  {userSpeech[idx] && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Your Attempt
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMatchScore(para, userSpeech[idx]) > 80 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                        >
                          Score: {getMatchScore(para, userSpeech[idx])}%
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 italic">
                        "{userSpeech[idx]}"
                      </p>
                    </div>
                  )}

                  {/* Verb Detection Panel */}
                  {verbPopover?.paragraphIdx === idx && verbPopover.verbs.length > 0 && (
                    <div className="mt-4 border-t border-teal-100 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">
                          Verbs Detected
                        </span>
                        <button
                          onClick={() => setVerbPopover(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
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
                              </div>
                              {v.inflected_form && (
                                <p className="text-xs text-slate-500 mt-1">
                                  <span className="font-japanese">{v.inflected_form}</span>
                                  {v.inflection_label && ` · ${v.inflection_label}`}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => addVerbToDeck(v, verbPopover.sourceSentence)}
                              className="ml-3 shrink-0 text-xs bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hinglish Card */}
                <div className="bg-slate-100/50 p-6 md:p-8 rounded-3xl border border-dashed border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
                    Translation
                  </span>
                  <p className="text-lg text-slate-600 leading-relaxed italic font-medium">
                    {hinglishPara}
                  </p>
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* Grammar section */}
      <section className="mt-16 mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="bg-indigo-600 text-white p-1 rounded">📚</span>{" "}
          Grammar Masterlist
        </h2>
        <div className="space-y-8">
          {["N5", "N4", "N3", "N2", "N1"].map((level) => {
            const pointsAtLevel = lessonData?.grammar_points?.filter(
              (p) => p.level === level,
            );
            if (!pointsAtLevel || pointsAtLevel.length === 0) return null;
            return (
              <div key={level}>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 border-b pb-1">
                  Level {level} Concepts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pointsAtLevel.map((grammar, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-indigo-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xl font-bold text-indigo-900 font-japanese">
                          {grammar.grammar_structure}
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                          {level}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed italic">
                        {grammar.explanation_hinglish}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all ${
            toast.type === "warning"
              ? "bg-amber-500 text-white"
              : toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-teal-700 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
