import { atom } from "jotai";
import { Competition } from "./interfaces";

const competitionAtom = atom<Competition | null>(null);

export { competitionAtom };