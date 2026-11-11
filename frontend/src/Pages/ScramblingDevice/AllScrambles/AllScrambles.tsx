import { useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";

import DevicePage from "../Components/DevicePage";
import UnlockCard from "../Components/UnlockCard";
import { scrambleSetName } from "../scramblingDeviceContext";
import { useUnlockableScrambleSet } from "../useUnlockableScrambleSet";
import ScramblesList from "./Components/ScramblesList";

const AllScrambles = () => {
    const { id } = useParams<{ id: string }>();
    const {
        scrambleSet,
        scrambles,
        unlock,
        unlockError,
        clearUnlockError,
        isUnlocking,
    } = useUnlockableScrambleSet(id);

    if (!scrambleSet) return <LoadingPage />;

    const setName = scrambleSetName(scrambleSet);

    return (
        <DevicePage title={scrambles ? `${setName} · All scrambles` : setName}>
            {scrambles ? (
                <ScramblesList
                    scrambles={scrambles}
                    eventId={scrambleSet.roundId.split("-")[0]}
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

export default AllScrambles;
