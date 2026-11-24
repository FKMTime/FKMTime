import { TriangleAlert } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import {
    DecryptedScramble,
    ScrambleSet as ScrambleSetData,
} from "@/lib/interfaces";
import { scramblingDeviceH2hQuery } from "@/lib/scrambling";

import DevicePage from "../Components/DevicePage";
import UnlockCard from "../Components/UnlockCard";
import {
    currentGroupIdForRound,
    h2hScramblePath,
    scrambleSetName,
    stationNamesForRound,
    useScramblingDeviceRoom,
} from "../scramblingDeviceContext";
import { useUnlockableScrambleSet } from "../useUnlockableScrambleSet";
import H2hScrambleCard from "./Components/H2hScrambleCard";
import Scrambling from "./Components/Scrambling";

/** How often the match is read again, to move on to the next point */
const H2H_REFRESH_MS = 3_000;

/** The next point's scramble of a head-to-head match, from this set */
const H2hScrambling = ({
    matchId,
    scrambleSet,
    scrambles,
}: {
    matchId: string;
    scrambleSet: ScrambleSetData;
    scrambles: DecryptedScramble[];
}) => {
    const navigate = useNavigate();
    const { data: matches } = useLiveQuery(
        scramblingDeviceH2hQuery(scrambleSet.roundId),
        { refetchInterval: H2H_REFRESH_MS }
    );
    if (!matches) return <LoadingPage />;
    return (
        <H2hScrambleCard
            match={matches.find((m) => m.matchId === matchId) ?? null}
            scrambleSetId={scrambleSet.id}
            scrambles={scrambles}
            eventId={scrambleSet.roundId.split("-")[0]}
            onOpenSet={(id) => navigate(h2hScramblePath(matchId, id))}
            onBack={() => navigate("/scrambling-device")}
        />
    );
};

const ScrambleSet = () => {
    const { id } = useParams<{ id: string }>();
    // Opened for a head-to-head match from the home screen (SPEC-001)
    const matchId = useSearchParams()[0].get("match");
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
    // A station of this room pointed at the round (SPEC-007) has no group
    const isAtPointedStation =
        stationNamesForRound(room, scrambleSet.roundId).length > 0;

    return (
        <DevicePage title={setName}>
            {scrambles ? (
                <>
                    {!groupId && !isAtPointedStation && (
                        <p
                            role="alert"
                            className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning"
                        >
                            <TriangleAlert className="mt-px size-[18px] shrink-0" />
                            This round isn&apos;t running in this room. Check
                            that this is the right set before scrambling.
                        </p>
                    )}
                    {matchId ? (
                        <H2hScrambling
                            matchId={matchId}
                            scrambleSet={scrambleSet}
                            scrambles={scrambles}
                        />
                    ) : (
                        <Scrambling
                            roundId={scrambleSet.roundId}
                            groupId={groupId}
                            scrambles={scrambles}
                        />
                    )}
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
