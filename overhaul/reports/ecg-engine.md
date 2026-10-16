# ecg-engine report

## Result
`npx vitest run tests/ecg`: 11 files, 1254 tests, all passing. This includes criteria, fidelity, fuzz, engine, extra, plus heart's hemo and explain tests. `tsc --noEmit` shows no errors in engine or test files. The two errors it does report are in `src/ecg/ui/heart/view.ts`, which belongs to heart and is still being rebuilt.

## Changes, file by file
- **src/ecg/engine/rhythm.ts**
  - Concealed retrograde penetration after a PVC now leaves the AV node as refractory as a wavefront that has just crossed it (`vaDelay + avnAHmin`).
  - In dual-pathway hearts it also resets the fast- and slow-pathway entry times.
  - Effect: every sinus P that falls during a PVC is blocked. Bigeminy rate now equals the sinus rate (75 vs 71, was 90 vs 71), and no post-PVC P conducts with a long PR. Interpolated PVCs at slow sinus rates still conduct.
- **src/ecg/engine/morphology.ts**
  - **WPW delta wave:** the `'ramp'` shape now fades smoothly (zero slope) instead of dropping fastest just as the His impulse arrives. That fast drop caused the 0.066 mV notch. The septal-q filter from the overhaul is kept, because loss of the septal q is a real sign of pre-excitation. `SHAPE_AREA.ramp` is updated to 0.45.
  - **Pre-excited fusion beats** can no longer be wider than full pre-excitation. In pre-excited AF some had been 223 ms wide against 148 ms for a fully pre-excited beat.
  - **Sine-wave hyperkalaemia (K⁺ ≥ 8.5):** activation components are spread out in time with their area kept, so the QRS is broad and smooth. The T wave becomes broad and discordant. hyperK9 now has QRS 230 ms with a true up-down sine cycle; before, it was a sharp R followed by a peaked T. hyperK8 keeps its peaked, concordant T.
  - **PE / S1Q3T3:** the initial forces are now displaced superiorly (about −30°), so there is a q in III and no q in I. The PE preset previously had no Q3, although the McGinn–White eponym links to it.
  - **Takotsubo:** the apical repolarisation vector now gives the deepest T inversion in V3–V6 and II, an upright T in aVR, and spares V1 (V1 T was −4 mm). Verified against Kosuge et al., Circ J 2012;76:462 (PMID 22133904, doi:10.1253/circj.cj-11-1036).
  - **Hypothermia:** the Osborn wave now uses the Ito J-wave direction (the same mechanism as early repolarisation). It is upright in II, III, aVF and V2–V6 and inverted in aVR. It had been inverted in V1–V2.
- **src/ecg/engine/measure.ts** (AV-relation read-out only; `conductedFraction` is unchanged)
  - Blocked P waves explained by ectopy are no longer reported as "x of y conducted". Blocked PACs and P waves coinciding with a PVC or VT run now read "1:1 AV conduction of sinus beats; …".
  - Fixed-ratio block is named by its ratio: "2:1 AV conduction (7 of 14 …)".
  - When a ventricular rhythm dominates: "AV dissociation during the VT / torsades de pointes / idioventricular rhythm; …".
- **src/ecg/engine/presets.ts**
  - highGrade gets `ventEscapeRate: 28`. Before, a ventricular escape fell in each cycle and the strip showed 4:1, not the labelled 3:1. It is now 3:1 at 30/min.
  - Physiology text corrected for stemiPosterior (tall R waves develop later; STE in V7–V9), pe (S1Q3T3) and takotsubo (lead distribution).
- **tests/ecg/criteria.test.ts:** 10 regression tests added, covering bigeminy blocking, interpolated PVC, the fusion width cap, S1Q3T3, the takotsubo V1/aVR pattern, Osborn polarity, sine-wave shape and polarity, AV-relation wording, and 2:1 / 3:1 naming.
- **tests/ecg/fidelity-helpers.ts:** its private copy of the `'ramp'` shape now matches the engine.
- **tests/ecg/fidelity.test.ts:** the tolerance between signal and reported QRS duration is 20 ms for hyperK9 only, because the onset of a sine wave is indistinct by definition. Every other preset stays at 12 ms.

## Conflicting merge hunks (earlier branch vs overhaul)
For each, the chosen behaviour passes both suites.
- **hyperK width:** kept the overhaul's version (very similar result).
- **Sine wave:** the overhaul's merged T (from 7.6) is kept, and the smoothed, discordant sine-wave stage is now added for K ≥ 8.5.
- **Kept the overhaul's version, no change needed:** measure.ts dominant-beat and QT pool (more complete); proxRCA weight (V4R STE 1.7 mm, III > II); Q-wave amplitude; LV strain; RV strain T3 direction; lae, poorR, lowVolt, rvh raSize (all meet their criteria); af age (affects haemodynamics only).
- **WPW:** fixed as described above.

## How I verified
- I bundled the engine with rolldown in my scratchpad and ran a numeric sweep of all 129 presets: rate, atrial rate, regularity, PR, QRS, QT/QTcB/QTcF, axis, AV relation, and per lead R, S, q, J, ST60, T and P (V4R and V7–V9 where relevant).
- I rendered 12-lead images through Playwright for about 27 presets and looked at the suspicious ones: wpw, hyperK9, flutter21, af, pe, stemiInferior, torsades, hypothermia, lbbb, vvi, atWithBlock.

## Per-preset table
| Preset | Issue found | Fixed? |
|---|---|---|
| pvcBigeminy | Some post-PVC P waves conducted with PR 225–237 ms; ventricular rate 19/min above the sinus rate | Yes |
| wpw | Delta wave dipped 0.066 mV back toward baseline before the R peak | Yes |
| preexAf | Fused beats up to 223 ms, wider than full pre-excitation (148) | Yes |
| hyperK9 | Not a sine wave (sharp R plus peaked T) | Yes |
| pe | No Q3 (S1Q3T3 incomplete, although the eponym links to this preset) | Yes |
| takotsubo | Deep T inversion in V1 (Kosuge: V1 spared) | Yes |
| hypothermia | Osborn wave inverted in V1–V2 | Yes |
| highGrade | Strip showed 4:1, not 3:1 (ventricular escape every cycle) | Yes (preset) |
| pvc, pvcCouplet, myocarditis, nsvt, arvc, cpvt, pacBlocked | Read-out "x of y P waves conducted" implied AV block | Yes (wording) |
| avb21, atWithBlock | Read-out did not name the 2:1 ratio | Yes |
| polyVT, torsades, aivr | Read-out did not mention AV dissociation | Yes |
| stemiPosterior | Text claimed tall R in V1–V3; the acute model shows R/S ≈ 0.9 in V2 | Text corrected |
| copd | P in II is 1.7 mm (below the 2.5 mm P-pulmonale threshold; content lists P pulmonale) | No: needs an implausible raSize or an unsupported mechanism; sent to ecg-content |
| digoxinEffect, atWithBlock | About 1–2 mm reciprocal ST elevation in V1–V2 (ST vector opposite to the QRS) | No: physiologically defensible, unsure |
| vvi / paced | R in V6 is positive; RV-apical pacing often gives a negative V6 | No: literature uncertain |
| rbbb, mobitz2 | Deep S in V1 (1.5 mV) before R′ 1.1 mV | No: it is the normal V1 S; changing the timing did not alter it |
| lbbb | Tall discordant T in V1 (10 mm against a 14.5 mm QS) | No: within the reported range |
| All other presets | No error found | — |

All other presets: nsr, sinusBrady, sinusTach, sinusArrhythmia, sinusPause, sinusArrest, saExitBlock, ist, pac, pacAberrant, pvcInterpolated, focalAT, mat, flutter21, flutter41, flutterVariable, af, afRvr, junctional ×3, avnrt, orthoAvrt, concealedAvrt, antiAvrt, avb1, mobitz1, chbJunctional, chbVentricular, incompleteRbbb, lafb, lpfb, bifascicular, rbbbLpfb, ivcd, ventEscape, monoVT, rvotVT, fascicularVT, bidirectionalVT, vflutter, vf, asystole, pea, pulselessVT, aai, dddTracking, dddSequential, failCapture, failSense, oversense, lvh, lvhVoltage, rvh, rae, lae, poorR, lowVolt, stemiAnterior, stemiInferior, stemiLateral, hyperacute, evolvingMI, oldInferior, wellens, subendo, pericarditis, pericarditis3, pulmHtn, hyperK6, hyperK7, hyperK8, hypoK, hyperCa, hypoCa, hypoMg, hyperMg, betaBlocker, ccbTox, tca, flecainide, qtDrug, amiodarone, lqts, sqts, earlyRepol, brugada1, brugada2, hcm, arvcVT, athlete, deWinter, lvAneurysm, dextrocardia, the three lead reversals, artifactMotion, artifactTremor.

## Not done
- I did not screenshot every preset; this was deliberate, to stay within the usage limits. I relied on the numeric sweep plus images of about 27 presets.
- Interpolated-PVC PR prolongation is only about 3 ms. The model's short AV-node refractory constants recover fast. I left them alone because Wenckebach and other tuning depend on them.

## Inbox items
- My inbox was empty throughout.
- **To ecg-content:** the COPD "P pulmonale" wording vs the copd preset; the new AV-relation wording; the preset text changes.
- **To ecg-ui:** the longer avRelation strings need to wrap on a phone.
- **To heart:** an FYI on component and behaviour changes. No exported interface changed.
