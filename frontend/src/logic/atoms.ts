import { atom } from "jotai";
import { Competition } from "./interfaces";

const competitionAtom = atom<Competition | null>(null);
const showSidebarAtom = atom<boolean>(true);

export { competitionAtom, showSidebarAtom };
