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

    return (
        <DevicePage title={setName}>
            {scrambles ? (
                <Scrambling
                    groupId={
                        currentGroupIdForRound(room, scrambleSet.roundId) ?? ""
                    }
                    scrambles={scrambles}
                />
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
