import { ReactNode } from "react";
import { Link } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import { StatusTone } from "@/Components/shared/status";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { getEventIconClass } from "@/lib/events";
import {
    AttemptStatus,
    Incident,
    PersonIncidents as PersonIncidentsData,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { formatDayTime } from "@/lib/time";
import { cn, shortRoundName } from "@/lib/utils";

const OUTCOME: Partial<
    Record<AttemptStatus, { label: string; tone: StatusTone }>
> = {
    [AttemptStatus.UNRESOLVED]: { label: "Open", tone: "destructive" },
    [AttemptStatus.RESOLVED]: { label: "Resolved", tone: "success" },
    [AttemptStatus.EXTRA_GIVEN]: { label: "Extra granted", tone: "warning" },
};

const RoundName = ({ roundId }: { roundId: string }) => (
    <span className="inline-flex items-center gap-1.5">
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

const Section = ({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
            {children}
        </ul>
    </section>
);

interface PersonIncidentsProps {
    personId: string;
    incidents: PersonIncidentsData;
}

const PersonIncidents = ({ personId, incidents }: PersonIncidentsProps) => {
    const { attempts, manual, noteworthy } = incidents;
    if (attempts.length + manual.length + noteworthy.length === 0)
        return <EmptyState>No incidents.</EmptyState>;

    const attemptLink = (incident: Incident) =>
        incident.status === AttemptStatus.UNRESOLVED
            ? `/incidents/${incident.id}`
            : `/results/${incident.result.id}`;

    return (
        <div className="flex flex-col gap-5">
            {attempts.length > 0 && (
                <Section title="Attempts">
                    {attempts.map((incident) => {
                        const outcome = OUTCOME[incident.status];
                        const asJudge = incident.result.person.id !== personId;
                        const details = [
                            asJudge
                                ? `Judged ${incident.result.person.name}`
                                : incident.judge &&
                                  `Judge ${incident.judge.name}`,
                            incident.device?.name,
                            incident.comment,
                        ].filter(Boolean);
                        return (
                            <li key={incident.id}>
                                <Link
                                    to={attemptLink(incident)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent md:px-5"
                                >
                                    <div className="min-w-0 flex-1 text-sm">
                                        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                                            <RoundName
                                                roundId={
                                                    incident.result.roundId
                                                }
                                            />
                                            <span className="font-normal text-muted-foreground">
                                                Attempt {incident.attemptNumber}
                                                {incident.solvedAt &&
                                                    ` · ${formatDayTime(incident.solvedAt)}`}
                                            </span>
                                        </p>
                                        {details.length > 0 && (
                                            <p className="truncate text-[13px] text-muted-foreground">
                                                {details.join(" · ")}
                                            </p>
                                        )}
                                    </div>
                                    <span className="shrink-0 font-bold">
                                        {attemptWithPenaltyToString(incident)}
                                    </span>
                                    <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                                        {outcome && (
                                            <StatusBadge tone={outcome.tone}>
                                                {outcome.label}
                                            </StatusBadge>
                                        )}
                                        {asJudge && (
                                            <StatusBadge tone="neutral">
                                                As judge
                                            </StatusBadge>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </Section>
            )}

            {manual.length > 0 && (
                <Section title="Manual incidents">
                    {manual.map((incident) => (
                        <li
                            key={incident.id}
                            className="px-4 py-3 text-sm md:px-5"
                        >
                            <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                                {incident.roundId && (
                                    <RoundName roundId={incident.roundId} />
                                )}
                                {incident.attempt && (
                                    <span className="font-normal text-muted-foreground">
                                        Attempt {incident.attempt}
                                    </span>
                                )}
                            </p>
                            <p>{incident.description}</p>
                            {incident.createdBy?.fullName && (
                                <p className="text-xs text-faint">
                                    by {incident.createdBy.fullName}
                                </p>
                            )}
                        </li>
                    ))}
                </Section>
            )}

            {noteworthy.length > 0 && (
                <Section title="Noteworthy">
                    {noteworthy.map((incident) => (
                        <li
                            key={incident.id}
                            className="px-4 py-3 text-sm md:px-5"
                        >
                            <p className="font-semibold">{incident.title}</p>
                            {incident.description && (
                                <p className="text-muted-foreground">
                                    {incident.description}
                                </p>
                            )}
                            {incident.createdBy?.fullName && (
                                <p className="text-xs text-faint">
                                    by {incident.createdBy.fullName}
                                </p>
                            )}
                        </li>
                    ))}
                </Section>
            )}
        </div>
    );
};

export default PersonIncidents;
