import React, { useEffect, useState } from "react";
import { loadDictionary } from "../utils/kuromojiManager";
import { extractVerbsFromText, fetchVerbMeanings, addVerbToSupabase } from "../utils/verbUtils";
import VerbPanel, { VerbToast } from "./VerbPanel";

const convertToHiragana = (katakanaStr) => {
  if (!katakanaStr) return "";
  return katakanaStr.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
};

export default function StudyModule({ lessonData, onBack }) {
  const [tokenizedParagraphs, setTokenizedParagraphs] = useState([]);
  const [isDictLoading, setIsDictLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showFurigana, setShowFurigana] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(null);
  const [isRecording, setIsRecording] = useState(null);
  const [userSpeech, setUserSpeech] = useState({});
  const [verbPopover, setVerbPopover] = useState(null);
  const [isFetchingMeanings, setIsFetchingMeanings] = useState(false);
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

  const handleParagraphMouseUp = async (para, idx) => {
    const selectedText = window.getSelection()?.toString().trim();
    if (!selectedText) { setVerbPopover(null); return; }

    const verbs = await extractVerbsFromText(selectedText);
    if (!verbs.length) { setVerbPopover(null); return; }

    setVerbPopover({ paragraphIdx: idx, verbs, sourceSentence: para });

    setIsFetchingMeanings(true);
    const meanings = await fetchVerbMeanings(verbs.map((v) => v.plain_form));
    setVerbPopover((prev) =>
      prev ? { ...prev, verbs: prev.verbs.map((v) => ({ ...v, meaning_hinglish: meanings[v.plain_form] || '' })) } : null
    );
    setIsFetchingMeanings(false);
  };

  const addVerbToDeck = async (verb, sourceSentence) => {
    const result = await addVerbToSupabase(verb, sourceSentence);
    if (result.status === 'duplicate') showToast(`${verb.plain_form} is already in your Verb Deck`, 'warning');
    else if (result.status === 'error') showToast('Failed to add verb. Please try again.', 'error');
    else showToast(`Added ${verb.plain_form} to Verb Deck!`);
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
          <ruby className={`ruby-position ${isTargetVocab ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-700 dark:text-slate-200"}`}>
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
    return <div className="p-8 text-red-500 dark:text-red-400 text-center">{errorMessage}</div>;
  if (isDictLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-indigo-500 dark:text-indigo-400 animate-pulse">
        Loading ...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {lessonData?.topic_english}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {lessonData?.topic_japanese}
          </p>
        </div>
        <button
          onClick={() => setShowFurigana(!showFurigana)}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${showFurigana ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-slate-700"}`}
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
                <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                  <span className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest block mb-4">
                    Paragraph {idx + 1}
                  </span>
                  <div
                    className="text-2xl leading-[2.8] text-slate-700 dark:text-slate-200 font-japanese mb-6 cursor-text select-text"
                    onMouseUp={() => handleParagraphMouseUp(para, idx)}
                  >
                    {tokenizedParagraphs[idx]?.map((token, tokenIdx) =>
                      renderToken(token, tokenIdx),
                    )}
                  </div>

                  {/* Audio & Mic Controls */}
                  <div className="flex items-center gap-2 border-t dark:border-slate-700 pt-4">
                    <button
                      onClick={() => toggleSpeech(para, idx)}
                      className={`p-2 rounded-lg transition-all ${isSpeaking === idx ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"}`}
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
                      className={`p-2 rounded-lg transition-all ml-auto ${isRecording === idx ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400"}`}
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
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Your Attempt
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMatchScore(para, userSpeech[idx]) > 80 ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400"}`}
                        >
                          Score: {getMatchScore(para, userSpeech[idx])}%
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                        "{userSpeech[idx]}"
                      </p>
                    </div>
                  )}

                  {verbPopover?.paragraphIdx === idx && (
                    <VerbPanel
                      verbPopover={verbPopover}
                      isFetchingMeanings={isFetchingMeanings}
                      onAdd={addVerbToDeck}
                      onClose={() => setVerbPopover(null)}
                    />
                  )}
                </div>

                {/* Hinglish Card */}
                <div className="bg-slate-100/50 dark:bg-slate-800/40 p-6 md:p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-4">
                    Translation
                  </span>
                  <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed italic font-medium">
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6 flex items-center gap-2">
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
                <h3 className="text-sm font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-4 border-b dark:border-slate-700 pb-1">
                  Level {level} Concepts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pointsAtLevel.map((grammar, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xl font-bold text-indigo-900 dark:text-indigo-300 font-japanese">
                          {grammar.grammar_structure}
                        </span>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                          {level}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed italic">
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

      <VerbToast toast={toast} />
    </div>
  );
}
