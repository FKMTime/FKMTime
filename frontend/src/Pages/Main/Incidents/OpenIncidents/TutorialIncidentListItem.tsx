import { Link } from "react-router-dom";

import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Attempt } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { formatElapsed } from "@/lib/time";
import { TutorialIncident } from "@/lib/tutorial";
import { cn } from "@/lib/utils";

interface TutorialIncidentListItemProps {
    incident: TutorialIncident;
    roomName?: string;
    isSelected: boolean;
    now: Date;
}

/** A delegate call made during a tutorial, next to the real ones (SPEC-012) */
const TutorialIncidentListItem = ({
    incident,
    roomName,
    isSelected,
    now,
}: TutorialIncidentListItemProps) => {
    const details = [
        incident.deviceName,
        incident.judgeName && `Judge ${incident.judgeName}`,
    ].filter(Boolean);
    const when = [roomName, formatElapsed(incident.createdAt, now)].filter(
        Boolean
    );

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
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold md:text-base">
                    <span className="truncate">{incident.competitorName}</span>
                    <StatusBadge tone="primary">Tutorial</StatusBadge>
                </p>
                <p className="truncate text-[13px] text-muted-foreground md:text-sm">
                    {details.join(" · ")}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className="text-base font-bold md:text-lg">
                    {attemptWithPenaltyToString(incident as unknown as Attempt)}
                </p>
                <p className="text-xs text-faint">{when.join(" · ")}</p>
            </div>
        </Link>
    );
};

export default TutorialIncidentListItem;
