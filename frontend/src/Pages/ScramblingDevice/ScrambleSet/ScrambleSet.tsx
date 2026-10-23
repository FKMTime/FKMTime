import { TriangleAlert } from "lucide-react";
import { useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";

import DevicePage from "../Components/DevicePage";
import UnlockCard from "../Components/UnlockCard";
import {
    currentGroupIdForRound,
    scrambleSetName,
    useScramblingDeviceRoom,
} from "../scramblingDeviceContext";
import { useUnlockableScrambleSet } from "../useUnlockableScrambleSet";
import Scrambling from "./Components/Scrambling";

const ScrambleSet = () => {
    const { id } = useParams<{ id: string }>();
    const room = useScramblingDeviceRoom();
    const {
        scrambleSet,
        scrambles,
        unlock,
        unlockError,
        clearUnlockError,
        isUnlocking,
    } = useUnlockableScrambleSet(id);

    if (!scrambleSet || !room) return <LoadingPage />;

    const setName = scrambleSetName(scrambleSet);
    const groupId = currentGroupIdForRound(room, scrambleSet.roundId);

    return (
        <DevicePage title={setName}>
            {scrambles ? (
                <>
                    {!groupId && (
                        <p
                            role="alert"
                            className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning"
                        >
                            <TriangleAlert className="mt-px size-[18px] shrink-0" />
                            This round isn&apos;t running in this room. Check
                            that this is the right set before scrambling.
                        </p>
                    )}
                    <Scrambling
                        roundId={scrambleSet.roundId}
                        groupId={groupId}
                        scrambles={scrambles}
                    />
                </>
            ) : (
                <UnlockCard
                    setName={setName}
                    error={unlockError}
                    isUnlocking={isUnlocking}
                    onUnlock={unlock}
                    onChange={clearUnlockError}
                />
            )}
        </DevicePage>
    );
};

export default ScrambleSet;
