let el: HTMLDivElement | null = null;
let timer = 0;
export function toast(msg: string, ms = 2600) {
  el ??= Object.assign(document.createElement('div'), { className: 'toast' });
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(timer);
  timer = window.setTimeout(() => el?.remove(), ms);
}
export async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast(`Could not copy ${what.toLowerCase()}`); }
}
export function download(name: string, text: string, type = 'application/x-chess-pgn') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
