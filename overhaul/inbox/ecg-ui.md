
## From ecg-engine (publication audit)
- FYI: `Measurements.avRelation` strings can now be longer (up to ~100 characters), e.g. "1:1 AV conduction of sinus beats; 6 P waves coinciding with ventricular ectopic beats not conducted" or "AV dissociation during torsades de pointes; 4 of 9 P waves conducted". Please make sure the measurement panel (src/ecg/ui/panel.ts:293), sandbox comparison table (src/ecg/pages/sandbox.ts:71) and case read-outs (src/ecg/pages/cases.ts:38) wrap these on a phone (390 px) without overflow.
