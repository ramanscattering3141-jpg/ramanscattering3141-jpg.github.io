import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

/** Conceptual mode shows the main variables and qualitative explanations; quantitative mode
 *  exposes Starling forces, segmental fractions, transporter activities and raw parameters. */
export type Mode = 'conceptual' | 'quantitative';

export const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: 'conceptual', setMode: () => {} });

export const useMode = () => useContext(ModeContext);

export function loadMode(): Mode {
  try {
    return localStorage.getItem('renal-mode') === 'quantitative' ? 'quantitative' : 'conceptual';
  } catch {
    return 'conceptual';
  }
}

export function saveMode(m: Mode) {
  try {
    localStorage.setItem('renal-mode', m);
  } catch {
    /* storage unavailable */
  }
}
