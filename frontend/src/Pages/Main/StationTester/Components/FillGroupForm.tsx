import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import InlineError from "@/Components/shared/InlineError";
import ProgressBar from "@/Components/shared/ProgressBar";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { createDevice, setStationsRound } from "@/lib/devices";
import {
    Device,
    DeviceType,
    HardwareVersion,
    Person,
    Result,
    Room,
} from "@/lib/interfaces";
import { allPersonsQuery, assignCard } from "@/lib/persons";
import { setQueryData } from "@/lib/queryCache";
import { getResultsByRoundId } from "@/lib/results";
import { getRoundsInScheduleOrder, roundName } from "@/lib/roundOptions";
import {
    generateCardId,
    generateEspId,
    generateSessionId,
    hasCard,
    sendStationPacket,
    StationExchange,
} from "@/lib/stationTester";
import {
    DEFAULT_PENALTY_ODDS,
    FillJob,
    FillOutcome,
    getCompetitorsToFill,
    getRoundGroups,
    getUnfillableReason,
    pickJudges,
    planFill,
    runFill,
} from "@/lib/stationTesterBulk";

/** The station every fill sends from, created on the first fill */
export const FILLER_STATION_NAME = "Results filler";

const WHOLE_ROUND = "whole-round";

interface FillGroupFormProps {
    wcif: WCIF | null;
    persons: Person[];
    devices: Device[];
    rooms: Room[];
    /** Each reply, so the page's reply panel shows the latest one */
    onExchange: (exchange: StationExchange) => void;
    /** After the filler station was created */
    onDevicesChanged: () => void;
}

type Phase =
    | { kind: "idle" }
    | { kind: "preparing"; message: string }
    | { kind: "sending"; sent: number; total: number }
    | { kind: "finished"; outcome: FillOutcome; total: number };

const percentValue = (value: string) =>
    Math.min(100, Math.max(0, Number(value) || 0));

/**
 * Plays a station for every competitor of a group, or of a whole round:
 * dev-only, to get a competition full of results through the real path.
 */
const FillGroupForm = ({
    wcif,
    persons,
    devices,
    rooms,
    onExchange,
    onDevicesChanged,
}: FillGroupFormProps) => {
    const id = useId();
    const roundIds = useMemo(
        () => (wcif ? getRoundsInScheduleOrder(wcif) : []),
        [wcif]
    );
    const [roundId, setRoundId] = useState("");
    const [group, setGroup] = useState(WHOLE_ROUND);
    const [plusTwoPercent, setPlusTwoPercent] = useState(
        DEFAULT_PENALTY_ODDS.plusTwoPercent.toString()
    );
    const [dnfPercent, setDnfPercent] = useState(
        DEFAULT_PENALTY_ODDS.dnfPercent.toString()
    );
    const [phase, setPhase] = useState<Phase>({ kind: "idle" });
    const [error, setError] = useState("");
    const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>(
        []
    );
    const [failedJob, setFailedJob] = useState<FillJob | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    const round = wcif?.events
        .flatMap((event) => event.rounds)
        .find((r) => r.id === roundId);
    const unfillableReason = round ? getUnfillableReason(round) : null;
    const groups = useMemo(
        () => (wcif && roundId ? getRoundGroups(wcif, roundId) : []),
        [wcif, roundId]
    );
    const groupId = group === WHOLE_ROUND ? null : group;
    const competitorCount = useMemo(
        () =>
            wcif && roundId
                ? getCompetitorsToFill(wcif, roundId, groupId, []).length
                : 0,
        [wcif, roundId, groupId]
    );
    const isRunning = phase.kind === "preparing" || phase.kind === "sending";

    if (!wcif) {
        return (
            <p className="text-sm text-muted-foreground">
                Import a competition first.
            </p>
        );
    }

    const selectRound = (value: string) => {
        setRoundId(value);
        setGroup(WHOLE_ROUND);
        setPhase({ kind: "idle" });
        setError("");
    };

    const getFillerStation = async (): Promise<Device | null> => {
        const existing = devices.find(
            (device) =>
                device.name === FILLER_STATION_NAME &&
                device.type === DeviceType.STATION &&
                !device.retiredAt
        );
        if (existing) return existing;
        if (!rooms[0]) {
            setError("Add a room first: the filler station needs one.");
            return null;
        }
        const { status, device } = await createDevice({
            name: FILLER_STATION_NAME,
            espId: +generateEspId(),
            type: DeviceType.STATION,
            roomId: rooms[0].id,
            hwVersion: HardwareVersion.V4,
        });
        if (!device) {
            setError(
                `Couldn't create the "${FILLER_STATION_NAME}" station (${status}).`
            );
            return null;
        }
        onDevicesChanged();
        return device;
    };

    /** Gives a card to everyone in the fill who has none */
    const withCards = async (
        people: Person[],
        signal: AbortSignal
    ): Promise<Map<string, string> | null> => {
        const cards = new Map<string, string>();
        const missing = people.filter((person) => !hasCard(person.cardId));
        for (const person of people)
            if (hasCard(person.cardId)) cards.set(person.id, person.cardId!);
        for (const [index, person] of missing.entries()) {
            if (signal.aborted) return null;
            setPhase({
                kind: "preparing",
                message: `Giving cards: ${index + 1}/${missing.length}`,
            });
            const cardId = generateCardId();
            const status = await assignCard(person.id, cardId);
            if (status !== 200) {
                setError(`Couldn't give ${person.name} a card (${status}).`);
                return null;
            }
            cards.set(person.id, cardId);
            setQueryData<Person[]>(allPersonsQuery.key, (previous = []) =>
                previous.map((p) => (p.id === person.id ? { ...p, cardId } : p))
            );
        }
        return cards;
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!round || unfillableReason) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setError("");
        setSkipped([]);
        setFailedJob(null);
        setPhase({ kind: "preparing", message: "Reading the round..." });

        const results = await getResultsByRoundId(roundId);
        const plan = planFill({
            wcif,
            roundId,
            groupId,
            persons,
            roundResults: Array.isArray(results) ? (results as Result[]) : [],
            odds: {
                plusTwoPercent: percentValue(plusTwoPercent),
                dnfPercent: percentValue(dnfPercent),
            },
            rng: Math.random,
        });
        setSkipped(plan.skipped);
        if (plan.jobs.length === 0) {
            setError("Nobody left to fill in this group.");
            setPhase({ kind: "idle" });
            return;
        }
        const { primary, backup } = pickJudges(
            persons,
            plan.jobs.map((job) => job.person.id)
        );
        if (!primary || !backup) {
            setError("Judging needs at least two people in FKMTime.");
            setPhase({ kind: "idle" });
            return;
        }

        const station = await getFillerStation();
        if (!station) return setPhase({ kind: "idle" });
        const cards = await withCards(
            [
                ...new Map(
                    [
                        primary,
                        backup,
                        ...plan.jobs.map((job) => job.person),
                    ].map((p) => [p.id, p])
                ).values(),
            ],
            controller.signal
        );
        if (!cards) return setPhase({ kind: "idle" });
        const jobs = plan.jobs.map((job) => ({
            ...job,
            person: { ...job.person, cardId: cards.get(job.person.id) },
        }));

        // Pointed at the round, the station takes any of its groups (SPEC-007)
        const previousRoundId = station.customRoundId ?? null;
        if (previousRoundId !== roundId) {
            setPhase({
                kind: "preparing",
                message: "Pointing the station at the round...",
            });
            const status = await setStationsRound([station.id], roundId);
            if (status !== 200) {
                setError(
                    `Couldn't point "${station.name}" at the round (${status}).`
                );
                return setPhase({ kind: "idle" });
            }
        }

        try {
            setPhase({ kind: "sending", sent: 0, total: plan.totalAttempts });
            let sentSoFar = 0;
            const outcome = await runFill({
                jobs,
                espId: station.espId,
                // A judge can't judge themselves, so the backup judges them
                getJudgeCard: (competitor) =>
                    cards.get(
                        competitor.id === primary.id ? backup.id : primary.id
                    )!,
                send: sendStationPacket,
                newSessionId: generateSessionId,
                signal: controller.signal,
                onProgress: (progress, exchange) => {
                    sentSoFar = progress.sent;
                    setPhase({ kind: "sending", ...progress });
                    onExchange(exchange);
                },
            });
            if (outcome.status === "failed") {
                onExchange(outcome.exchange);
                // Sent one at a time, so the refused one is the next after those sent
                let count = 0;
                setFailedJob(
                    jobs.find(
                        (job) => (count += job.attempts.length) > sentSoFar
                    ) ?? null
                );
            }
            setPhase({ kind: "finished", outcome, total: plan.totalAttempts });
        } catch (thrown) {
            setError(String(thrown));
            setPhase({ kind: "idle" });
        } finally {
            if (previousRoundId !== roundId)
                await setStationsRound([station.id], previousRoundId);
        }
    };

    const replyMessage = (exchange: StationExchange) => {
        const reply = exchange.reply as {
            data?: { message?: string };
            error?: string;
            message?: string;
        };
        return (
            reply?.data?.message ??
            reply?.message ??
            reply?.error ??
            JSON.stringify(exchange.reply)
        );
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-round`}>Round</Label>
                <Select
                    value={roundId}
                    onValueChange={selectRound}
                    disabled={isRunning}
                >
                    <SelectTrigger id={`${id}-round`} aria-label="Round">
                        <SelectValue placeholder="Select round" />
                    </SelectTrigger>
                    <SelectContent>
                        {roundIds.map((value) => (
                            <SelectItem key={value} value={value}>
                                {roundName(value)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {roundId && !unfillableReason && (
                <div className="flex flex-col gap-1.5">
                    <Label>Group</Label>
                    <SegmentedControl
                        label="Group"
                        value={group}
                        onValueChange={(value) => {
                            if (!isRunning) setGroup(value);
                        }}
                        options={[
                            { value: WHOLE_ROUND, label: "Whole round" },
                            ...groups.map(({ groupId: value }) => ({
                                value,
                                label: `Group ${value.split("-g")[1]}`,
                            })),
                        ]}
                    />
                </div>
            )}
            <InlineError>{unfillableReason}</InlineError>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-plus-two`}>+2 chance (%)</Label>
                    <Input
                        id={`${id}-plus-two`}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={plusTwoPercent}
                        onChange={(event) =>
                            setPlusTwoPercent(event.target.value)
                        }
                        disabled={isRunning}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-dnf`}>DNF chance (%)</Label>
                    <Input
                        id={`${id}-dnf`}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={dnfPercent}
                        onChange={(event) => setDnfPercent(event.target.value)}
                        disabled={isRunning}
                    />
                </div>
            </div>
            {roundId && !unfillableReason && (
                <p className="text-sm text-muted-foreground">
                    {competitorCount}{" "}
                    {competitorCount === 1 ? "competitor" : "competitors"},
                    every attempt the format needs, cut short by the cutoff.
                    Sent from the station "{FILLER_STATION_NAME}", pointed at
                    the round while filling. Competitors without a card get one.
                </p>
            )}
            {phase.kind === "preparing" && (
                <p className="text-sm text-muted-foreground">{phase.message}</p>
            )}
            {(phase.kind === "sending" || phase.kind === "finished") && (
                <div className="flex flex-col gap-1.5">
                    <ProgressBar
                        label="Attempts sent"
                        value={
                            phase.kind === "sending"
                                ? phase.sent
                                : phase.outcome.sent
                        }
                        max={phase.total}
                    />
                    <p className="text-sm tabular-nums">
                        {phase.kind === "sending"
                            ? phase.sent
                            : phase.outcome.sent}
                        /{phase.total} attempts
                        {phase.kind === "finished" &&
                            phase.outcome.status === "done" &&
                            " · Done"}
                        {phase.kind === "finished" &&
                            phase.outcome.status === "cancelled" &&
                            " · Cancelled"}
                    </p>
                </div>
            )}
            <InlineError>
                {phase.kind === "finished" &&
                    phase.outcome.status === "failed" &&
                    `Stopped${failedJob ? ` at ${failedJob.person.name}` : ""}: ${replyMessage(phase.outcome.exchange)}`}
            </InlineError>
            <InlineError>{error}</InlineError>
            {skipped.length > 0 && (
                <details className="text-sm text-muted-foreground">
                    <summary>{skipped.length} skipped</summary>
                    <ul className="mt-1.5 list-disc pl-5">
                        {skipped.map((entry) => (
                            <li key={entry.name}>
                                {entry.name}: {entry.reason}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {isRunning ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => abortRef.current?.abort()}
                >
                    Cancel
                </Button>
            ) : (
                <Button type="submit" disabled={!roundId || !!unfillableReason}>
                    Fill with results
                </Button>
            )}
        </form>
    );
};

export default FillGroupForm;
