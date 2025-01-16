import { atom } from "jotai";

import { Competition } from "./interfaces";

const competitionAtom = atom<Competition | null>(null);

const unresolvedIncidentsCountAtom = atom<number>(0);

export { competitionAtom, unresolvedIncidentsCountAtom };
