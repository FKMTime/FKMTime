import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import AutoChangeSwitch from "./AutoChangeSwitch";
import RoomRow, { RoomTableHeader } from "./RoomRow";
import RoundsToOpenDialog from "./RoundsToOpenDialog";
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
        startedRounds,
        clearStartedRounds,
        isAutoChange,
        isAutoChangeKnown,
        isAutoChangeSaving,
        setAutoChange,
    } = useCurrentGroups();

    if (isLoading || !competition) return <LoadingPage />;

    return (
        <>
            <SetupTabs value="groups" />
            {roundIds.map((roundId) => (
                <ResultsRoom key={roundId} roundId={roundId} />
            ))}
            <RoundsToOpenDialog
                roundIds={startedRounds}
                onClose={clearStartedRounds}
            />
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
                            rooms={rooms}
                            wcif={competition.wcif}
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
