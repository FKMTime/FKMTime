import { Timer } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { StatusTone } from "@/Components/shared/status";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useIsMobile } from "@/hooks/useMobile";
import { usePageHeader } from "@/hooks/usePageHeader";
import { deviceAttemptsQuery } from "@/lib/devices";
import { getEventIconClass } from "@/lib/events";
import { AttemptStatus, AttemptType, DeviceAttempt } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { LIVE_MAX_AGE, QueryError } from "@/lib/queryCache";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { formatDayTime } from "@/lib/time";
import { cn, shortRoundName } from "@/lib/utils";

/** Only attempts that don't simply count get a badge */
const STATUS: Partial<
    Record<AttemptStatus, { label: string; tone: StatusTone }>
> = {
    [AttemptStatus.UNRESOLVED]: { label: "Open incident", tone: "destructive" },
    [AttemptStatus.RESOLVED]: { label: "Resolved", tone: "success" },
    [AttemptStatus.EXTRA_GIVEN]: { label: "Extra granted", tone: "warning" },
    [AttemptStatus.SCRAMBLED]: { label: "Scrambled only", tone: "neutral" },
    [AttemptStatus.VOIDED]: { label: "Extra not needed", tone: "neutral" },
};

const attemptLabel = (attempt: DeviceAttempt) =>
    `${attempt.type === AttemptType.EXTRA_ATTEMPT ? "Extra" : "Attempt"} ${attempt.attemptNumber}`;

const solvedAtLabel = (attempt: DeviceAttempt) =>
    formatDayTime(attempt.solvedAt ?? attempt.createdAt);

const RoundName = ({ roundId }: { roundId: string }) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
            aria-hidden
            className={cn(
                "cubing-icon",
                getEventIconClass(roundId.split("-")[0])
            )}
        />
        {shortRoundName(roundId)}
    </span>
);

const StatusCell = ({ status }: { status: AttemptStatus }) => {
    const badge = STATUS[status];
    return badge ? (
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
    ) : null;
};

const Competitor = ({
    attempt,
    canOpenResult,
}: {
    attempt: DeviceAttempt;
    canOpenResult: boolean;
}) =>
    canOpenResult ? (
        <Link
            to={`/results/${attempt.result.id}`}
            className="font-medium hover:underline"
        >
            {attempt.result.person.name}
        </Link>
    ) : (
        <span className="font-medium">{attempt.result.person.name}</span>
    );

/** Every solve one device recorded, newest first */
const DeviceSolves = () => {
    const { id = "" } = useParams<{ id: string }>();
    const isMobile = useIsMobile();
    const { data, error, isError, refetch } = useLiveQuery(
        deviceAttemptsQuery(id),
        { maxAge: LIVE_MAX_AGE }
    );
    const canOpenResult = isDelegate();
    const deviceName = data?.device.name ?? "Device";
    const count = data?.attempts.length;

    usePageHeader({
        crumbs: [
            { label: "Devices", to: "/devices" },
            { label: `${deviceName} solves` },
        ],
        title: deviceName,
        subtitle:
            count === undefined
                ? undefined
                : `${count} ${count === 1 ? "solve" : "solves"}`,
        backTo: "/devices",
    });

    if (error instanceof QueryError && error.status === 404)
        return <EmptyState>This device doesn't exist anymore.</EmptyState>;
    if (!data) {
        if (isError) return <RequestError onRetry={() => void refetch()} />;
        return <SectionLoading label="Loading solves" />;
    }

    const { attempts } = data;
    return (
        <div className="flex flex-col gap-4">
            {isError && <RequestError hasData onRetry={() => void refetch()} />}
            {attempts.length === 0 ? (
                <EmptyState icon={<Timer />}>
                    No solves on this device yet.
                </EmptyState>
            ) : isMobile ? (
                <ol className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card">
                    {attempts.map((attempt) => (
                        <li
                            key={attempt.id}
                            className="flex flex-col gap-1 px-4 py-2.5"
                        >
                            <div className="flex items-center gap-3">
                                <span className="min-w-0 flex-1 truncate">
                                    <Competitor
                                        attempt={attempt}
                                        canOpenResult={canOpenResult}
                                    />
                                </span>
                                <b className="font-semibold">
                                    {attemptWithPenaltyToString(attempt)}
                                </b>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <RoundName roundId={attempt.result.roundId} />
                                <span>{attemptLabel(attempt)}</span>
                                <span>{solvedAtLabel(attempt)}</span>
                                <StatusCell status={attempt.status} />
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="overflow-x-auto rounded-2xl border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-5">Solved</TableHead>
                                <TableHead>Competitor</TableHead>
                                <TableHead>Round</TableHead>
                                <TableHead>Attempt</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Judge</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attempts.map((attempt) => (
                                <TableRow key={attempt.id}>
                                    <TableCell className="whitespace-nowrap pl-5 text-muted-foreground">
                                        {solvedAtLabel(attempt)}
                                    </TableCell>
                                    <TableCell>
                                        <Competitor
                                            attempt={attempt}
                                            canOpenResult={canOpenResult}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <RoundName
                                            roundId={attempt.result.roundId}
                                        />
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {attemptLabel(attempt)}
                                    </TableCell>
                                    <TableCell className="font-semibold">
                                        {attemptWithPenaltyToString(attempt)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {attempt.judge?.name ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <StatusCell status={attempt.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default DeviceSolves;
