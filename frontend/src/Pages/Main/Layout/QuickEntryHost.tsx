import { useAtom } from "jotai";
import { useEffect, useState } from "react";

import { quickEntryAtom } from "@/lib/atoms";
import { Room } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";
import QuickEnterAttemptModal from "@/Pages/Main/Home/Components/QuickEnterAttemptModal";

/** Mounts the quick entry modal once for the header button and the FAB */
const QuickEntryHost = () => {
    const [quickEntry, setQuickEntry] = useAtom(quickEntryAtom);
    const [currentRoundIds, setCurrentRoundIds] = useState<string[]>([]);

    useEffect(() => {
        if (!quickEntry.isOpen || quickEntry.roundId) return;
        getAllRooms().then((rooms: Room[]) => {
            const roundIds = rooms
                .flatMap((room) => room.currentGroupIds)
                .map((groupId) => groupId.split("-g")[0]);
            setCurrentRoundIds([...new Set(roundIds)]);
        });
    }, [quickEntry.isOpen, quickEntry.roundId]);

    return (
        <QuickEnterAttemptModal
            // Remount per round so the form starts clean
            key={quickEntry.roundId ?? "current"}
            isOpen={quickEntry.isOpen}
            onClose={() => setQuickEntry({ isOpen: false })}
            roundId={quickEntry.roundId}
            roundOptions={currentRoundIds}
        />
    );
};

export default QuickEntryHost;
