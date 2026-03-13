
// src/components/AiSenseiChat.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function AiSenseiChat({ isOpen, onClose, selectedText }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Build the prompt dynamically based on if text is highlighted
      const systemPrompt = `You are 'Sensei', a master Japanese linguist.
      ${selectedText ? `\nCURRENTLY HIGHLIGHTED TEXT ON USER'S SCREEN: "${selectedText}"\nFocus your explanation heavily on this selected text.` : ''}
      RULES:
      - Explain clearly and concisely.
      - If explaining grammar or vocab, ALWAYS provide 2 examples.
      - Format examples neatly with Japanese, Furigana, and English/Hinglish meaning.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "qwen/qwen-2.5-72b-instruct",
          "messages": [
            { "role": "system", "content": systemPrompt },
            ...messages,
            userMessage
          ]
        })
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Network error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-100 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
      
      {/* Drawer Header */}
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-black text-slate-800 flex items-center gap-2">
          <span className="text-xl">🎓</span> AI Sensei
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Context Indicator (Shows what user has highlighted) */}
      {selectedText && (
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 text-sm text-indigo-800">
          <span className="font-bold text-[10px] uppercase tracking-wider text-indigo-500 block mb-1">Target Context</span>
          <span className="font-japanese font-medium line-clamp-2">"{selectedText}"</span>
        </div>
      )}

      {/* Chat History */}
      <div ref={scrollRef} className="grow p-5 overflow-y-auto space-y-4 bg-white">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm mt-10">
            Highlight any text on the screen, then ask me to explain it, break down the grammar, or provide examples.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {isTyping && <div className="text-xs text-slate-400 font-medium animate-pulse">Thinking...</div>}
      </div>

      {/* Input Field */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about the highlight..."
            className="grow bg-transparent border-none px-3 py-2 text-sm focus:outline-none focus:ring-0 text-slate-700 placeholder-slate-400"
          />
          <button onClick={sendMessage} className="bg-white text-indigo-600 shadow-sm px-4 py-2 rounded-xl font-bold text-sm hover:shadow-md transition-all">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}