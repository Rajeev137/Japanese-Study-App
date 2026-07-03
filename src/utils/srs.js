// Shared SM-2 spaced-repetition helpers

export function sm2(quality, intervalDays, easeFactor, reviewCount) {
  let newEase = easeFactor + 0.1 - (5 - quality) * 0.08;
  newEase = Math.max(1.3, newEase);
  let newInterval;

  if (quality < 3) {
    newInterval = 1;
  } else if (reviewCount === 0) {
    newInterval = 1;
  } else if (reviewCount === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(intervalDays * easeFactor);
  }

  return { nextIntervalDays: newInterval, nextEaseFactor: newEase };
}

export function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export function formatNextReview(isoDate) {
  if (!isoDate) return null;
  const days = Math.round((new Date(isoDate) - new Date()) / 86400000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function isDue(record, now = new Date()) {
  return !record || new Date(record.next_review) <= now;
}

// ---- Study streak (localStorage) ----
export function getStreak() {
  return {
    count: parseInt(localStorage.getItem('streak_count') || '0', 10),
    lastDate: localStorage.getItem('streak_last_date') || null,
  };
}

export function bumpStreak() {
  const today = new Date().toDateString();
  const { count, lastDate } = getStreak();
  if (lastDate === today) return count;

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newCount = lastDate === yesterday ? count + 1 : 1;
  localStorage.setItem('streak_count', String(newCount));
  localStorage.setItem('streak_last_date', today);
  return newCount;
}

export function streakIsAlive() {
  const { lastDate } = getStreak();
  if (!lastDate) return false;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  return lastDate === today || lastDate === yesterday;
}
