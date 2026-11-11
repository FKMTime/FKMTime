import { useAtom } from "jotai";
import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { quickEntryAtom } from "@/lib/atoms";
import { getQuickEntryRounds } from "@/lib/quickEntry";
import { roomsQuery } from "@/lib/rooms";

import QuickEnterAttemptModal, {
    QuickEntryRound,
} from "./QuickEnterAttemptModal";

/** Mounts the quick entry modal once for the header button and the FAB */
const QuickEntryHost = () => {
    const [quickEntry, setQuickEntry] = useAtom(quickEntryAtom);
    // The rounds running now, when entering without a round chosen
    const { data: rooms } = useLiveQuery(roomsQuery, {
        enabled: quickEntry.isOpen && !quickEntry.roundId,
    });
    const currentRounds: QuickEntryRound[] = useMemo(
        () => getQuickEntryRounds(rooms ?? []),
        [rooms]
    );

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
