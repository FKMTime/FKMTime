import { useAtomValue } from "jotai";
import { useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EventChips from "@/Components/shared/EventChips";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { competitionAtom } from "@/lib/atoms";
import {
    getEventIconClass,
    getEventName,
    getEventShortName,
} from "@/lib/events";
import { ScrambleSet } from "@/lib/interfaces";
import {
    scramblingDeviceH2hQuery,
    scramblingDeviceSetsQuery,
} from "@/lib/scrambling";
import { cn } from "@/lib/utils";

import DevicePage from "../Components/DevicePage";
import {
    currentGroupIdForRound,
    roundIdsRunningHere,
    roundName,
    stationNamesForRound,
    useScramblingDeviceRoom,
} from "../scramblingDeviceContext";
import H2hMatchesList from "./Components/H2hMatchesList";
import ScrambleSetsList from "./Components/ScrambleSetsList";

/** How often a head-to-head round's matches are read again */
const H2H_REFRESH_MS = 3_000;

const ScramblingDeviceHome = () => {
    const competition = useAtomValue(competitionAtom);
    const room = useScramblingDeviceRoom();
    const [selectedRoundId, setSelectedRoundId] = useState("");

    const events = competition?.wcif.events ?? [];
    // Includes rounds a delegate pointed a station of this room at
    const liveRoundIds = roundIdsRunningHere(room);
    // Until something is picked, follow the round running in this room
    const roundId =
        selectedRoundId || liveRoundIds[0] || events[0]?.rounds[0]?.id || "";
    const eventId = roundId.split("-")[0];
    const event = events.find((e) => e.id === eventId);
    const currentGroupId = currentGroupIdForRound(room, roundId);
    const pointedStationNames = stationNamesForRound(room, roundId);
    const isRunningHere = !!currentGroupId || pointedStationNames.length > 0;
    // A head-to-head point's scramble comes from its match (SPEC-001)
    const isH2h = event?.rounds.find((r) => r.id === roundId)?.format === "h";

    // null while the selected round's sets load
    const { data: scrambleSetsData } = useLiveQuery(
        scramblingDeviceSetsQuery(roundId),
        { enabled: !!roundId }
    );
    const scrambleSets: ScrambleSet[] | null = scrambleSetsData ?? null;
    const { data: h2hMatches } = useLiveQuery(
        scramblingDeviceH2hQuery(roundId),
        { enabled: isH2h, refetchInterval: H2H_REFRESH_MS }
    );

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
                                    isRunningHere
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                {currentGroupId
                                    ? `In progress in this room · Group ${currentGroupId.split("-g")[1]}`
                                    : pointedStationNames.length > 0
                                      ? `Running at ${pointedStationNames.join(", ")}`
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
                    {isH2h && (
                        <H2hMatchesList
                            matches={h2hMatches ?? null}
                            canScramble={isRunningHere}
                        />
                    )}
                    <ScrambleSetsList
                        scrambleSets={scrambleSets}
                        canScramble={isRunningHere && !isH2h}
                    />
                </section>
            )}
        </DevicePage>
    );
};

export default ScramblingDeviceHome;
