import React from 'react';

export const parseFuriganaString = (text) => {
  if (!text) return null;
  const regex = /\{([^|]+)\|([^}]+)\}/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    elements.push(
      <ruby key={match.index} className="mx-px text-slate-800 dark:text-slate-200">
        {match[1]}
        <rt className="text-[10px] text-slate-400 dark:text-slate-500 font-normal pb-0.5 select-none">{match[2]}</rt>
      </ruby>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) elements.push(text.substring(lastIndex));
  return elements;
};
