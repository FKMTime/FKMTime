import { useAtom } from "jotai";
import { useEffect, useState } from "react";

import { quickEntryAtom } from "@/lib/atoms";
import { Room } from "@/lib/interfaces";
import { getQuickEntryRounds } from "@/lib/quickEntry";
import { getAllRooms } from "@/lib/rooms";

import QuickEnterAttemptModal, {
    QuickEntryRound,
} from "./QuickEnterAttemptModal";

/** Mounts the quick entry modal once for the header button and the FAB */
const QuickEntryHost = () => {
    const [quickEntry, setQuickEntry] = useAtom(quickEntryAtom);
    const [currentRounds, setCurrentRounds] = useState<QuickEntryRound[]>([]);

    useEffect(() => {
        if (!quickEntry.isOpen || quickEntry.roundId) return;
        getAllRooms().then((rooms: Room[]) =>
            setCurrentRounds(getQuickEntryRounds(rooms))
        );
    }, [quickEntry.isOpen, quickEntry.roundId]);

    return (
        <QuickEnterAttemptModal
            // Remount per round so the form starts clean
            key={quickEntry.roundId ?? "current"}
            isOpen={quickEntry.isOpen}
            onClose={() => setQuickEntry({ isOpen: false })}
            roundId={quickEntry.roundId}
            roundOptions={currentRounds}
        />
    );
};

export default QuickEntryHost;
