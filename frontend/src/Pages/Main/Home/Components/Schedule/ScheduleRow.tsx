import { Event, Round } from "@wca/helpers";
import { prettyRoundFormat } from "wcif-helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { TableCell, TableRow } from "@/Components/ui/table";
import { getActivityName } from "@/lib/activities";
import { Activity } from "@/lib/interfaces";
import { resultToString } from "@/lib/resultFormatters";
import {
    cumulativeRoundsToString,
    formatTime,
    getFormattedRealActivityTime,
} from "@/lib/utils";

interface ScheduleRowProps {
    activity: Activity;
    events: Event[];
}

const ScheduleRow = ({ activity, events }: ScheduleRowProps) => {
    const eventId = activity.activityCode.split("-")[0];
    const event = events.find((e: Event) => e.id === eventId);
    const round = event?.rounds.find(
        (r: Round) => r.id === activity.activityCode
    );
    const formattedRealTime = getFormattedRealActivityTime(
        activity.realStartTime,
        activity.realEndTime
    );

    return (
        <TableRow key={activity.id}>
            <TableCell>
                {formatTime(activity.startTime)} -{" "}
                {formatTime(activity.endTime)}
            </TableCell>
            <TableCell>{formattedRealTime}</TableCell>
            <TableCell className="flex gap-1 items-center">
                {!activity.activityCode.startsWith("other") && (
                    <EventIcon
                        eventId={activity.activityCode.split("-r")[0]}
                        selected
                        size={16}
                    />
                )}
                {getActivityName(activity)}
            </TableCell>
            <TableCell>
                {round &&
                    round.format &&
                    prettyRoundFormat(
                        round?.format,
                        round?.cutoff?.numberOfAttempts
                    )}
            </TableCell>
            <TableCell
                title={`For ${cumulativeRoundsToString(round?.timeLimit?.cumulativeRoundIds || [])}`}
            >
                {round?.timeLimit &&
                    resultToString(round?.timeLimit?.centiseconds || 0)}{" "}
                {round?.timeLimit?.cumulativeRoundIds?.length || 0 > 1
                    ? "(cumulative)"
                    : ""}
            </TableCell>
            <TableCell>
                {round?.cutoff && resultToString(round?.cutoff?.attemptResult)}
            </TableCell>
            <TableCell>
                {round?.advancementCondition &&
                    `Top ${round.advancementCondition.level}${round?.advancementCondition?.type === "percent" ? "%" : ""}`}
            </TableCell>
            <TableCell>
                {activity.childActivities.length === 0
                    ? ""
                    : activity.childActivities.length}
            </TableCell>
        </TableRow>
    );
};

export default ScheduleRow;
