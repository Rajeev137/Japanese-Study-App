

// import React, { useEffect, useState } from "react";
// import kuromoji from "kuromoji/build/kuromoji.js";
// import lessonData from "./text.json";

// const convertToHiragana = (katakanaStr) => {
//   if (!katakanaStr) return "";
//   return katakanaStr.replace(/[\u30a1-\u30f6]/g, (match) => {
//     return String.fromCharCode(match.charCodeAt(0) - 0x60);
//   });
// };

// export default function StudyModule() {
//   const [tokenizedParagraphs, setTokenizedParagraphs] = useState([]);
//   const [isDictLoading, setIsDictLoading] = useState(true);
//   const [showFurigana, setShowFurigana] = useState(true); // NEW: Toggle state
//   const [isSpeaking, setIsSpeaking] = useState(null); // Track WHICH paragraph is playing

//   const toggleSpeech = (text, idx) => {
//     // 1. If we click a DIFFERENT paragraph while one is already playing
//     if (isSpeaking !== null && isSpeaking !== idx) {
//       window.speechSynthesis.cancel();
//     }

//     // 2. If it's the SAME paragraph, handle Pause/Resume
//     if (isSpeaking === idx) {
//       if (window.speechSynthesis.speaking) {
//         if (window.speechSynthesis.paused) {
//           window.speechSynthesis.resume();
//         } else {
//           window.speechSynthesis.pause();
//         }
//         return; // Exit
//       }
//     }

//     // 3. Start New Speech
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = "ja-JP";
//     utterance.rate = 0.85; // Slightly slower for study

//     utterance.onstart = () => setIsSpeaking(idx);
//     utterance.onend = () => setIsSpeaking(null);
//     utterance.onerror = () => setIsSpeaking(null);

//     window.speechSynthesis.speak(utterance);
//   };

//   const stopSpeech = () => {
//     window.speechSynthesis.cancel();
//     setIsSpeaking(null);
//   };

//   const [isRecording, setIsRecording] = useState(null); // Which paragraph is being recorded
//   const [userSpeech, setUserSpeech] = useState({}); // Stores recorded text for each paragraph: {0: "watashi wa...", 1: "tokyo ni..."}

//   const startRecording = (idx) => {
//     // Check if browser supports Speech Recognition
//     const SpeechRecognition =
//       window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition) {
//       alert(
//         "Speech recognition not supported in this browser. Try Chrome on Mac.",
//       );
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.lang = "ja-JP";
//     recognition.interimResults = false; // Only final result
//     recognition.continuous = false;

//     recognition.onstart = () => setIsRecording(idx);

//     recognition.onresult = (event) => {
//       const transcript = event.results[0][0].transcript;
//       // Save the recording result for this specific paragraph index
//       setUserSpeech((prev) => ({ ...prev, [idx]: transcript }));
//     };

//     recognition.onend = () => setIsRecording(null);
//     recognition.onerror = () => setIsRecording(null);

//     recognition.start();
//   };

//   const getMatchScore = (original, spoken) => {
//     if (!spoken) return null;

//     // Clean punctuation for better matching
//     const clean = (str) => str.replace(/[、。！？\s]/g, "");
//     const o = clean(original);
//     const s = clean(spoken);

//     if (o === s) return 100;

//     // Simple character-based overlap for a quick grade
//     let matches = 0;
//     for (let char of s) {
//       if (o.includes(char)) matches++;
//     }
//     return Math.round((matches / o.length) * 100);
//   };

//   useEffect(() => {
//     try {
//       kuromoji
//         .builder({
//           dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict",
//         })
//         .build((err, tokenizer) => {
//           if (err) {
//             console.error("Kuromoji failed:", err);
//             setErrorMessage("Failed to load Kuromoji dictionary.");
//             return;
//           }

//           const rawText = lessonData?.full_essay_japanese || "";
//           const paragraphs = rawText.split("\n\n");

//           const parsedParagraphs = paragraphs.map((paragraph) => {
//             if (!paragraph.trim()) return [];
//             return tokenizer.tokenize(paragraph);
//           });

//           setTokenizedParagraphs(parsedParagraphs);
//           setIsDictLoading(false);
//         });
//     } catch (error) {
//       console.error(error);
//       setErrorMessage(error.message);
//     }
//   }, []);

//   const renderToken = (token, index) => {
//     if (!token) return null;
//     const { surface_form, basic_form, reading } = token;

//     // Check if it's a target word from your Gemini JSON
//     const isTargetVocab = lessonData?.vocabulary_list?.find(
//       (v) => v.word_kanji === basic_form || v.word_kanji === surface_form,
//     );

//     const hasKanji = /[\u4e00-\u9faf]/.test(surface_form || "");

//     // THE MAGIC: Using <ruby> for constant top-readings
//     const furiganaText =
//       hasKanji && reading ? convertToHiragana(reading) : null;

//     // SCENARIO: Kanji word (Target or just standard)
//     if (hasKanji) {
//       return (
//         <span key={index} className="group relative inline-block mx-px">
//           <ruby
//             className={`ruby-position ${isTargetVocab ? "text-blue-600 font-bold" : "text-slate-700"}`}
//           >
//             {surface_form}
//             {/* This <rt> tag puts the text on TOP */}
//             {showFurigana && furiganaText && (
//               <rt className="text-[10px] text-slate-400 font-normal select-none">
//                 {furiganaText}
//               </rt>
//             )}
//           </ruby>

//           {/* We still keep the Hover Card for meanings if it's a target word */}
//           {isTargetVocab && (
//             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block w-max max-w-xs bg-gray-900 text-white text-sm rounded-lg p-3 shadow-xl z-50 pointer-events-none">
//               <span className="block text-blue-300 text-[10px] font-black uppercase mb-1">
//                 {isTargetVocab.jlpt_level}
//               </span>
//               <span className="block text-lg font-bold">
//                 {isTargetVocab.reading_hiragana}
//               </span>
//               <span className="block text-gray-200 mt-1">
//                 {isTargetVocab.meaning_hinglish}
//               </span>
//               <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
//             </div>
//           )}
//         </span>
//       );
//     }

//     return <span key={index}>{surface_form}</span>;
//   };

//   return (
//     <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
//       {/* Header with Toggle */}
//       <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
//         <div>
//           <h1 className="text-4xl font-black text-slate-800 tracking-tight">
//             {lessonData?.topic_english}
//           </h1>
//           <p className="text-slate-500 font-medium mt-1">
//             {lessonData?.topic_japanese}
//           </p>
//         </div>
//         <button
//           onClick={() => setShowFurigana(!showFurigana)}
//           className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
//             showFurigana
//               ? "bg-indigo-600 text-white shadow-indigo-200"
//               : "bg-white text-indigo-600 border-2 border-indigo-100"
//           }`}
//         >
//           {showFurigana ? "Reading Mode: ON" : "Reading Mode: OFF"}
//         </button>
//       </header>

//       {/* Side-by-Side Synchronized Grid */}
//       <div className="space-y-6">
//         {/* We map through the paragraphs of the Japanese essay */}
//         {(lessonData?.full_essay_japanese?.split("\n\n") || []).map(
//           (para, idx) => {
//             // Get the corresponding Hinglish paragraph for this index
//             const hinglishPara =
//               lessonData?.full_essay_hinglish?.split("\n\n")[idx];

//             return (
//               <div
//                 key={idx}
//                 className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
//               >
//                 {/* Japanese Card */}
//                 <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors">
//                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-4">
//                     Paragraph {idx + 1}
//                   </span>
//                   <div className="text-2xl leading-[2.8] text-slate-700 font-japanese">
//                     {/* We tokenize the Japanese text for this specific paragraph */}
//                     {/* Note: In a real app, you'd use the tokenizedParagraphs[idx] state we built earlier */}
//                     {tokenizedParagraphs[idx]?.map((token, tokenIdx) =>
//                       renderToken(token, tokenIdx),
//                     )}
//                   </div>
//                   <div className="flex items-center gap-2">
//                     {/* Play / Pause Button */}
//                     <button
//                       onClick={() => toggleSpeech(para, idx)}
//                       className={`p-2 rounded-lg transition-all ${isSpeaking === idx ? "bg-indigo-600 text-white" : "hover:bg-indigo-100 text-indigo-500"}`}
//                       title={isSpeaking === idx ? "Pause/Resume" : "Listen"}
//                     >
                      
//                       {isSpeaking === idx && !window.speechSynthesis.paused ? (
//                         // Pause Icon
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           width="18"
//                           height="18"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                           stroke="currentColor"
//                           strokeWidth="2.5"
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                         >
//                           <rect x="6" y="4" width="4" height="16"></rect>
//                           <rect x="14" y="4" width="4" height="16"></rect>
//                         </svg>
//                       ) : (
//                         // Play Icon
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           width="18"
//                           height="18"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                           stroke="currentColor"
//                           strokeWidth="2.5"
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                         >
//                           <polygon points="5 3 19 12 5 21 5 3"></polygon>
//                         </svg>
//                       )}
//                     </button>

//                     {/* Stop Button (Only shows when speaking) */}
//                     {isSpeaking === idx && (
//                       <button
//                         onClick={stopSpeech}
//                         className="p-2 text-red-400 hover:text-red-600 transition-colors"
//                         title="Stop"
//                       >
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           width="18"
//                           height="18"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                           stroke="currentColor"
//                           strokeWidth="2.5"
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                         >
//                           <rect
//                             x="3"
//                             y="3"
//                             width="18"
//                             height="18"
//                             rx="2"
//                             ry="2"
//                           ></rect>
//                         </svg>
//                       </button>
//                     )}
//                     {/* Record/Mic Button */}
//                       <button
//                         onClick={() => startRecording(idx)}
//                         className={`p-2 rounded-lg transition-all ${isRecording === idx ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500"}`}
//                       >
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           width="18"
//                           height="18"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                           stroke="currentColor"
//                           strokeWidth="2.5"
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                         >
//                           <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
//                           <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
//                           <line x1="12" y1="19" x2="12" y2="23"></line>
//                           <line x1="8" y1="23" x2="16" y2="23"></line>
//                         </svg>
//                       </button>
//                   </div>
//                 </div>
//                 {userSpeech[idx] && (
//                   <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
//                     <div className="flex justify-between items-center mb-2">
//                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
//                         Your Attempt
//                       </span>
//                       <span
//                         className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMatchScore(para, userSpeech[idx]) > 80 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
//                       >
//                         Score: {getMatchScore(para, userSpeech[idx])}%
//                       </span>
//                     </div>
//                     <p className="text-sm text-slate-500 italic mb-2">
//                       "{userSpeech[idx]}"
//                     </p>

//                     {getMatchScore(para, userSpeech[idx]) < 50 && (
//                       <p className="text-[10px] text-red-400 font-medium">
//                         Tip: Try speaking a bit slower and clearer!
//                       </p>
//                     )}
//                   </div>
//                 )}

//                 {/* Hinglish Card */}
//                 <div className="bg-slate-100/50 p-6 md:p-8 rounded-3xl border border-dashed border-slate-200 flex flex-col justify-center">
//                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
//                     Translation
//                   </span>
//                   <p className="text-lg text-slate-600 leading-relaxed italic font-medium">
//                     {hinglishPara}
//                   </p>
//                 </div>
//               </div>
//             );
//           },
//         )}
//       </div>

//       {/* Grammar Masterlist (Keep this at the bottom as a summary) */}
//       <div className="mt-16 pb-20">
//         {/* Enhanced Grammar Gallery */}
//         <section className="mt-10 mb-20">
//           <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//             <span className="bg-indigo-600 text-white p-1 rounded">📚</span>
//             Grammar Masterlist
//           </h2>

//           <div className="space-y-8">
//             {/* We group by levels: N5, N4, N3... */}
//             {["N5", "N4", "N3", "N2", "N1"].map((level) => {
//               const pointsAtLevel = lessonData?.grammar_points?.filter(
//                 (p) => p.level === level,
//               );

//               if (!pointsAtLevel || pointsAtLevel.length === 0) return null;

//               return (
//                 <div key={level}>
//                   <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 border-b pb-1">
//                     Level {level} Concepts
//                   </h3>
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                     {pointsAtLevel.map((grammar, idx) => (
//                       <div
//                         key={idx}
//                         className="bg-white border border-indigo-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500"
//                       >
//                         <div className="flex justify-between items-start mb-2">
//                           <span className="text-xl font-bold text-indigo-900 font-japanese">
//                             {grammar.grammar_structure}
//                           </span>
//                           <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
//                             {level}
//                           </span>
//                         </div>
//                         <p className="text-gray-600 text-sm leading-relaxed italic">
//                           {grammar.explanation_hinglish}
//                         </p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }





import React, { useEffect, useState } from "react";
// import kuromoji from "kuromoji/build/kuromoji.js";
import { loadDictionary } from '../utils/kuromojiManager';

// --- GLOBAL CACHE (Runs only once, outside the component) ---
let globalTokenizer = null;
let isInitializing = false;
let initializationQueue = [];

// const getKuromojiTokenizer = (callback) => {
//   // 1. If it's already loaded, return it instantly!
//   if (globalTokenizer) {
//     return callback(null, globalTokenizer);
//   }
  
//   // 2. If it's currently loading, wait in line instead of downloading again
//   if (isInitializing) {
//     initializationQueue.push(callback);
//     return;
//   }

//   // 3. First time loading: fetch from CDN
//   isInitializing = true;
//   kuromoji
//     .builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict" })
//     .build((err, tokenizer) => {
//       if (!err) globalTokenizer = tokenizer; // Save it to memory
      
//       callback(err, tokenizer);
      
//       // Tell anyone else waiting that it's ready
//       initializationQueue.forEach((cb) => cb(err, tokenizer));
//       initializationQueue = [];
//       isInitializing = false;
//     });
// };

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

  // useEffect(() => {
  //   setIsDictLoading(true);
    
  //   // Call our smart caching function instead of building from scratch
  //   getKuromojiTokenizer((err, tokenizer) => {
  //     if (err) {
  //       console.error("Kuromoji failed:", err);
  //       setErrorMessage("Failed to load Kuromoji dictionary.");
  //       setIsDictLoading(false);
  //       return;
  //     }

  //     try {
  //       const rawText = lessonData?.full_essay_japanese || "";
  //       const paragraphs = rawText.split("\n\n");

  //       const parsedParagraphs = paragraphs.map((paragraph) => {
  //         if (!paragraph.trim()) return [];
  //         return tokenizer.tokenize(paragraph);
  //       });

  //       setTokenizedParagraphs(parsedParagraphs);
  //       setIsDictLoading(false);
  //     } catch (error) {
  //       console.error(error);
  //       setErrorMessage(error.message);
  //       setIsDictLoading(false);
  //     }
  //   });
  // }, [lessonData]);

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
          setErrorMessage("Network error: Could not load the dictionary. Please refresh.");
          setIsDictLoading(false);
        });
    }, 100); 

  }, [lessonData]);

  const toggleSpeech = (text, idx) => {
    if (isSpeaking !== null && isSpeaking !== idx) window.speechSynthesis.cancel();
    if (isSpeaking === idx) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.paused ? window.speechSynthesis.resume() : window.speechSynthesis.pause();
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Try Chrome on Mac.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsRecording(idx);
    recognition.onresult = (event) => {
      setUserSpeech((prev) => ({ ...prev, [idx]: event.results[0][0].transcript }));
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

  if (errorMessage) return <div className="p-8 text-red-500 text-center">{errorMessage}</div>;
  if (isDictLoading) return <div className="min-h-screen flex items-center justify-center text-xl text-indigo-500 animate-pulse">Loading AI Dictionary...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Library
      </button>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{lessonData?.topic_english}</h1>
          <p className="text-slate-500 font-medium mt-1">{lessonData?.topic_japanese}</p>
        </div>
        <button
          onClick={() => setShowFurigana(!showFurigana)}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${showFurigana ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-white text-indigo-600 border-2 border-indigo-100"}`}
        >
          {showFurigana ? "Reading Mode: ON" : "Reading Mode: OFF"}
        </button>
      </header>

      <div className="space-y-6">
        {(lessonData?.full_essay_japanese?.split("\n\n") || []).map((para, idx) => {
          const hinglishPara = lessonData?.full_essay_hinglish?.split("\n\n")[idx];
          return (
            <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Japanese Card */}
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-4">Paragraph {idx + 1}</span>
                <div className="text-2xl leading-[2.8] text-slate-700 font-japanese mb-6">
                  {tokenizedParagraphs[idx]?.map((token, tokenIdx) => renderToken(token, tokenIdx))}
                </div>
                
                {/* Audio & Mic Controls */}
                <div className="flex items-center gap-2 border-t pt-4">
                  <button onClick={() => toggleSpeech(para, idx)} className={`p-2 rounded-lg transition-all ${isSpeaking === idx ? "bg-indigo-600 text-white" : "bg-slate-100 text-indigo-500 hover:bg-indigo-100"}`}>
                    {isSpeaking === idx && !window.speechSynthesis.paused ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    )}
                  </button>
                  {isSpeaking === idx && (
                    <button onClick={stopSpeech} className="p-2 text-red-400 hover:text-red-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                  )}
                  <button onClick={() => startRecording(idx)} className={`p-2 rounded-lg transition-all ml-auto ${isRecording === idx ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  </button>
                </div>

                {/* User Feedback */}
                {userSpeech[idx] && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Attempt</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMatchScore(para, userSpeech[idx]) > 80 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>Score: {getMatchScore(para, userSpeech[idx])}%</span>
                    </div>
                    <p className="text-sm text-slate-500 italic">"{userSpeech[idx]}"</p>
                  </div>
                )}
              </div>

              {/* Hinglish Card */}
              <div className="bg-slate-100/50 p-6 md:p-8 rounded-3xl border border-dashed border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Translation</span>
                <p className="text-lg text-slate-600 leading-relaxed italic font-medium">{hinglishPara}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grammar section */}
      <section className="mt-16 mb-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="bg-indigo-600 text-white p-1 rounded">📚</span> Grammar Masterlist
        </h2>
        <div className="space-y-8">
          {["N5", "N4", "N3", "N2", "N1"].map((level) => {
            const pointsAtLevel = lessonData?.grammar_points?.filter((p) => p.level === level);
            if (!pointsAtLevel || pointsAtLevel.length === 0) return null;
            return (
              <div key={level}>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 border-b pb-1">Level {level} Concepts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pointsAtLevel.map((grammar, idx) => (
                    <div key={idx} className="bg-white border border-indigo-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xl font-bold text-indigo-900 font-japanese">{grammar.grammar_structure}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{level}</span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed italic">{grammar.explanation_hinglish}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}