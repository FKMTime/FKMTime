import { StatusBadge } from "@/Components/shared/StatusBadge";
import { shortRoundName } from "@/lib/utils";

interface PointedStationBadgeProps {
    roundId: string;
    /** When the delegate pointed it, shown as "since 14:05" */
    since?: string | null;
}

/** Marks a station running another round than its room (SPEC-007) */
const PointedStationBadge = ({ roundId, since }: PointedStationBadgeProps) => (
    <StatusBadge tone="warning">
        Running {shortRoundName(roundId)}
        {since &&
            ` · since ${new Date(since).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`}
    </StatusBadge>
);

export default PointedStationBadge;
