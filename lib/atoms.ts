import { atom } from "jotai";

/** Giorno selezionato come offset da oggi: 0 = Oggi, 1 = Domani. Condiviso home ↔ dettaglio. */
export const dayOffsetAtom = atom<number>(0);

/** Stato connessione real-time mostrato in top bar */
export const liveStreamingAtom = atom<boolean>(false);
