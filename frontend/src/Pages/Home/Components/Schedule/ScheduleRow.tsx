import { Td, Tr } from "@chakra-ui/react";
import { Event, Round } from "@wca/helpers";
import { prettyRoundFormat } from "wcif-helpers";

import { getActivityName } from "@/logic/activities";
import { Activity } from "@/logic/interfaces.ts";
import { resultToString } from "@/logic/resultFormatters";
import {
    cumulativeRoundsToString,
    formatTime,
    getFormattedRealActivityTime,
} from "@/logic/utils";

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
        <Tr key={activity.id}>
            <Td>
                {formatTime(activity.startTime)} -{" "}
                {formatTime(activity.endTime)}
            </Td>
            <Td>{formattedRealTime}</Td>
            <Td>{getActivityName(activity)}</Td>
            <Td>
                {round &&
                    round.format &&
                    prettyRoundFormat(
                        round?.format,
                        round?.cutoff?.numberOfAttempts
                    )}
            </Td>
            <Td
                title={`For ${cumulativeRoundsToString(round?.timeLimit?.cumulativeRoundIds || [])}`}
            >
                {round?.timeLimit &&
                    resultToString(round?.timeLimit?.centiseconds || 0)}{" "}
                {round?.timeLimit?.cumulativeRoundIds?.length || 0 > 1
                    ? "(cumulative)"
                    : ""}
            </Td>
            <Td>
                {round?.cutoff && resultToString(round?.cutoff?.attemptResult)}
            </Td>
            <Td>
                {round?.advancementCondition &&
                    `Top ${round.advancementCondition.level}${round?.advancementCondition?.type === "percent" ? "%" : ""}`}
            </Td>
            <Td>
                {activity.childActivities.length === 0
                    ? ""
                    : activity.childActivities.length}
            </Td>
        </Tr>
    );
};

export default ScheduleRow;
