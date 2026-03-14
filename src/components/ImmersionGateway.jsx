// src/components/ImmersionGateway.jsx
import React from 'react';

export default function ImmersionGateway() {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-8 max-w-2xl w-full shadow-sm mx-auto mt-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
          <span className="text-indigo-600">🎧</span> 
          Native Immersion Portal
        </h2>
        <p className="text-lg text-slate-500 mt-2 font-medium">
          Launch your AI Sensei Chrome Extension on real-world platforms.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* YouTube Redirect */}
        <a 
          href="https://www.youtube.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-all group"
        >
          <div className="bg-white shadow-sm p-4 rounded-full text-red-500 group-hover:scale-110 transition-transform mb-4">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <h3 className="text-xl text-slate-800 font-bold mb-1">YouTube</h3>
          <p className="text-sm text-slate-500">Vlogs, Podcasts & News</p>
        </a>

        {/* Netflix Redirect */}
        <a 
          href="https://www.netflix.com/browse" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-all group"
        >
          <div className="bg-white shadow-sm p-4 rounded-full text-red-600 group-hover:scale-110 transition-transform mb-4">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.146 15.71l-5.636-9.15h3.401l3.87 6.476 4.097-6.476h3.4l-5.786 8.923 6.149 10.32h-3.418l-4.32-7.468-4.576 7.468H4.99l6.156-10.093z" />
            </svg>
          </div>
          <h3 className="text-xl text-slate-800 font-bold mb-1">Netflix</h3>
          <p className="text-sm text-slate-500">Anime & Terrace House</p>
        </a>
      </div>
    </div>
  );
}