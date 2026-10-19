import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EventChips from "@/Components/shared/EventChips";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { competitionAtom } from "@/lib/atoms";
import {
    getEventIconClass,
    getEventName,
    getEventShortName,
} from "@/lib/events";
import { ScrambleSet } from "@/lib/interfaces";
import { getScrambleSetsForScramblingDevice } from "@/lib/scrambling";
import { cn } from "@/lib/utils";

import DevicePage from "../Components/DevicePage";
import {
    currentGroupIdForRound,
    groupIdToRoundId,
    roundName,
    useScramblingDeviceRoom,
} from "../scramblingDeviceContext";
import ScrambleSetsList from "./Components/ScrambleSetsList";

const ScramblingDeviceHome = () => {
    const competition = useAtomValue(competitionAtom);
    const room = useScramblingDeviceRoom();
    const [selectedRoundId, setSelectedRoundId] = useState("");
    // null while the selected round's sets load
    const [scrambleSets, setScrambleSets] = useState<ScrambleSet[] | null>(
        null
    );

    const events = competition?.wcif.events ?? [];
    const liveRoundIds = room?.currentGroupIds.map(groupIdToRoundId) ?? [];
    // Until something is picked, follow the round running in this room
    const roundId =
        selectedRoundId || liveRoundIds[0] || events[0]?.rounds[0]?.id || "";
    const eventId = roundId.split("-")[0];
    const event = events.find((e) => e.id === eventId);
    const currentGroupId = currentGroupIdForRound(room, roundId);

    useEffect(() => {
        if (!roundId) return;
        let isCancelled = false;
        setScrambleSets(null);
        getScrambleSetsForScramblingDevice(roundId).then((data) => {
            if (!isCancelled) setScrambleSets(data);
        });
        return () => {
            isCancelled = true;
        };
    }, [roundId]);

    const pickEvent = (id: string) => {
        const rounds = events.find((e) => e.id === id)?.rounds ?? [];
        const live = rounds.find((r) => liveRoundIds.includes(r.id));
        setSelectedRoundId((live ?? rounds[0])?.id ?? "");
    };

    if (!competition || !room) return <LoadingPage />;

    return (
        <DevicePage title="Scramble sets" isHome>
            <EventChips
                value={eventId}
                onValueChange={pickEvent}
                events={events.map((e) => ({
                    id: e.id,
                    label: getEventShortName(e.id) || e.id,
                    name: getEventName(e.id) || e.id,
                    live: e.rounds.some((r) => liveRoundIds.includes(r.id)),
                }))}
            />
            {roundId && (
                <section className="rounded-2xl border bg-card">
                    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3.5 md:px-5">
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon text-[22px]",
                                getEventIconClass(eventId)
                            )}
                        />
                        <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                            <h2 className="text-base font-bold">
                                {roundName(roundId)}
                            </h2>
                            <p
                                className={cn(
                                    "text-[13px]",
                                    currentGroupId
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                {currentGroupId
                                    ? `In progress in this room · Group ${currentGroupId.split("-g")[1]}`
                                    : "Not in progress in this room"}
                            </p>
                        </div>
                        {event && event.rounds.length > 1 && (
                            <SegmentedControl
                                label="Round"
                                value={roundId}
                                onValueChange={setSelectedRoundId}
                                options={event.rounds.map((r) => ({
                                    value: r.id,
                                    label: (
                                        <>
                                            Round {r.id.split("-r")[1]}
                                            {liveRoundIds.includes(r.id) && (
                                                <StatusDot tone="primary" />
                                            )}
                                        </>
                                    ),
                                }))}
                            />
                        )}
                    </div>
                    <ScrambleSetsList
                        scrambleSets={scrambleSets}
                        canScramble={!!currentGroupId}
                    />
                </section>
            )}
        </DevicePage>
    );
};

export default ScramblingDeviceHome;
