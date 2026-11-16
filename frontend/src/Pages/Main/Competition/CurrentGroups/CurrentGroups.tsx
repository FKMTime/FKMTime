import { Info } from "lucide-react";
import { useMemo } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { Alert } from "@/Components/ui/alert";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { activityCodeToName } from "@/lib/activities";
import { getGroupOptions, getRoundsToOpen } from "@/lib/currentGroups";
import { isUnofficialEvent } from "@/lib/events";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import AutoChangeSwitch from "./AutoChangeSwitch";
import RoomRow, { RoomTableHeader } from "./RoomRow";
import { useCurrentGroups } from "./useCurrentGroups";

/** Keeps a round's results room joined while its group runs */
const ResultsRoom = ({ roundId }: { roundId: string }) => {
    useSocketRoom("Results", { params: { roundId } });
    return null;
};

/**
 * What every room runs now, how far its groups are, and what it starts
 * next. Each change saves at once, for that room only.
 */
const CurrentGroups = () => {
    const {
        competition,
        rooms,
        isLoading,
        nextGroups,
        roundIds,
        getProgress,
        now,
        setRoomGroups,
        isAutoChange,
        isAutoChangeKnown,
        isAutoChangeSaving,
        setAutoChange,
    } = useCurrentGroups();

    const groupOptions = useMemo(
        () => (competition ? getGroupOptions(competition.wcif) : []),
        [competition]
    );

    if (isLoading || !competition) return <LoadingPage />;

    const roundsToOpen = getRoundsToOpen(rooms, isUnofficialEvent);

    return (
        <>
            <SetupTabs value="groups" />
            {roundIds.map((roundId) => (
                <ResultsRoom key={roundId} roundId={roundId} />
            ))}
            {roundsToOpen.length > 0 && (
                <Alert>
                    <Info />
                    <p className="text-pretty">
                        Remember to open the following rounds in WCA Live:{" "}
                        {roundsToOpen.map((roundId, index) => (
                            <span key={roundId}>
                                <b className="font-semibold">
                                    {activityCodeToName(roundId).replace(
                                        ", ",
                                        " · "
                                    )}
                                </b>
                                {index < roundsToOpen.length - 1 && ", "}
                            </span>
                        ))}
                    </p>
                </Alert>
            )}
            <AutoChangeSwitch
                isOn={isAutoChange}
                disabled={!isAutoChangeKnown || isAutoChangeSaving}
                onChange={setAutoChange}
            />
            {rooms.length === 0 ? (
                <EmptyState>This competition has no rooms.</EmptyState>
            ) : (
                <div className="flex flex-col gap-3 md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:bg-card">
                    <RoomTableHeader />
                    {rooms.map((room) => (
                        <RoomRow
                            key={room.id}
                            room={room}
                            wcif={competition.wcif}
                            groupOptions={groupOptions}
                            nextGroupIds={nextGroups[room.id] ?? []}
                            getProgress={getProgress}
                            isAutoChange={isAutoChange}
                            now={now}
                            onSetGroups={setRoomGroups}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

export default CurrentGroups;
