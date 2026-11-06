import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? 'width:min(100%,1150px)' : ''}>
        <div class="row" style="margin-bottom:.6rem"><h2 class="grow" style="margin:0">{title}</h2><button class="btn icon" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}
