// Device capability hints used to choose safe defaults.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

/** Phones and tablets (including iPadOS, which reports itself as a Mac). */
export const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);

/** Chrome/Edge expose approximate RAM in GB; other browsers leave it undefined. */
export const lowMemory = isMobile || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

// Crash-loop protection: a flag is set while the page starts; if the tab is killed
// (e.g. out of GPU memory) before it clears, the next load starts in safe mode.
const BOOT_KEY = 'world-flight-sim.booting';
let crashedLastTime = false;
try {
  crashedLastTime = localStorage.getItem(BOOT_KEY) !== null;
  localStorage.setItem(BOOT_KEY, String(Date.now()));
  setTimeout(() => { try { localStorage.removeItem(BOOT_KEY); } catch { /* ignore */ } }, 30000);
} catch { /* storage unavailable */ }

export const recoveredFromCrash = crashedLastTime;
