import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'sensei_chat_history';

const SYSTEM_PROMPT = (selectedText, context) => `You are 'Sensei', a master Japanese linguist and teacher.
${context ? `\nSTUDY CONTEXT: The user is currently studying ${context}.` : ''}
${selectedText ? `\nHIGHLIGHTED TEXT: "${selectedText}"\nFocus your explanation on this selected text.` : ''}
RULES:
- Explain clearly and concisely.
- If explaining grammar or vocab, ALWAYS provide 2 example sentences.
- Format examples with: Japanese sentence, furigana/reading, and English/Hinglish meaning.
- Be warm and encouraging.`;

async function callClaudeStreaming(messages, systemPrompt, onChunk) {
  const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!claudeKey || claudeKey === 'your-claude-api-key-here') throw new Error('no_claude_key');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) throw new Error(`claude_${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text);
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

async function callGroq(messages, systemPrompt) {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) throw new Error('no_groq_key');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!response.ok) throw new Error(`groq_${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenRouter(messages, systemPrompt) {
  const orKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!orKey) throw new Error('no_or_key');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen-2.5-72b-instruct',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!response.ok) throw new Error(`openrouter_${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

export default function AiSenseiChat({ isOpen, onClose, selectedText, context }) {
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isTyping]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const userMsg = { role: 'user', content: userText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);
    setStreamingText('');

    const systemPrompt = SYSTEM_PROMPT(selectedText, context);
    // Only pass the last 10 messages to keep context manageable
    const apiMessages = updatedMessages.slice(-10);

    let reply = '';

    try {
      // Try Claude streaming first
      await callClaudeStreaming(apiMessages, systemPrompt, (chunk) => {
        reply += chunk;
        setStreamingText(reply);
      });
    } catch {
      // Fallback to Groq (non-streaming)
      try {
        reply = await callGroq(apiMessages, systemPrompt);
        setStreamingText(reply);
      } catch {
        // Final fallback: OpenRouter
        try {
          reply = await callOpenRouter(apiMessages, systemPrompt);
          setStreamingText(reply);
        } catch {
          reply = 'Sorry, all AI services are unavailable right now. Please try again.';
          setStreamingText(reply);
        }
      }
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    setStreamingText('');
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-105 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-white font-black px-2.5 py-1 rounded text-sm tracking-widest">先生</div>
          <h3 className="font-bold text-slate-800 text-base">AI Sensei</h3>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
              title="Clear history"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Selected text context */}
      {selectedText && (
        <div className="px-5 py-3 bg-orange-50 border-b border-orange-100">
          <span className="font-bold text-[10px] uppercase tracking-wider text-orange-500 block mb-1">Context</span>
          <span className="font-japanese text-sm text-slate-700 line-clamp-2">"{selectedText}"</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/50">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-slate-400 text-sm mt-16 leading-relaxed">
            Highlight any Japanese text on the page,<br />then ask me to explain it.
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-slate-800 text-white rounded-br-none'
                : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {/* Streaming bubble — shows while receiving */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-[88%] px-4 py-3 rounded-2xl rounded-bl-none bg-white text-slate-800 border border-slate-200 shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
              {streamingText || (
                <span className="flex gap-1 items-center text-slate-400">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: '120ms' }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: '240ms' }}>•</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex gap-2 items-end bg-slate-100 rounded-2xl p-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isTyping}
            placeholder={isTyping ? 'Sensei is thinking…' : 'Ask about the highlighted text…'}
            className="flex-1 bg-transparent border-none px-3 py-2 text-sm focus:outline-none resize-none text-slate-700 placeholder-slate-400 disabled:opacity-50 max-h-32"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={sendMessage}
            disabled={isTyping || !input.trim()}
            className="shrink-0 p-2.5 bg-slate-800 hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            title="Send (Enter)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
