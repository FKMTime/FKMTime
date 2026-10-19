import { Link } from "react-router-dom";

import { getEventIconClass } from "@/lib/events";
import { Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { formatElapsed } from "@/lib/time";
import { cn, shortRoundName } from "@/lib/utils";

interface IncidentListItemProps {
    incident: Incident;
    roomName?: string;
    isSelected: boolean;
    now: Date;
}

const IncidentListItem = ({
    incident,
    roomName,
    isSelected,
    now,
}: IncidentListItemProps) => {
    const details = [
        shortRoundName(incident.result.roundId),
        `Attempt ${incident.attemptNumber}`,
        incident.device?.name,
        incident.judge && `Judge ${incident.judge.name}`,
    ].filter(Boolean);
    const when = [
        roomName,
        incident.solvedAt && formatElapsed(incident.solvedAt, now),
    ].filter(Boolean);

    return (
        <Link
            to={`/incidents/${incident.id}`}
            aria-current={isSelected || undefined}
            className={cn(
                "flex items-center gap-3 rounded-mobile-card border bg-card p-3.5 transition-colors md:gap-4 md:rounded-2xl md:px-5 md:py-4",
                isSelected
                    ? "border-primary bg-primary-soft"
                    : "hover:border-border-strong"
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "cubing-icon shrink-0 text-2xl md:text-[26px]",
                    getEventIconClass(incident.result.eventId)
                )}
            />
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold md:text-base">
                    {incident.result.person.name}
                </p>
                <p className="truncate text-[13px] text-muted-foreground md:text-sm">
                    {details.join(" · ")}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className="text-base font-bold md:text-lg">
                    {attemptWithPenaltyToString(incident)}
                </p>
                <p className="text-xs text-faint">{when.join(" · ")}</p>
            </div>
        </Link>
    );
};

export default IncidentListItem;
