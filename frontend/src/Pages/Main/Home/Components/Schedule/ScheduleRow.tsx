import { Table } from "@chakra-ui/react";
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
        <Table.Row key={activity.id}>
            <Table.Cell>
                {formatTime(activity.startTime)} -{" "}
                {formatTime(activity.endTime)}
            </Table.Cell>
            <Table.Cell>{formattedRealTime}</Table.Cell>
            <Table.Cell>{getActivityName(activity)}</Table.Cell>
            <Table.Cell>
                {round &&
                    round.format &&
                    prettyRoundFormat(
                        round?.format,
                        round?.cutoff?.numberOfAttempts
                    )}
            </Table.Cell>
            <Table.Cell
                title={`For ${cumulativeRoundsToString(round?.timeLimit?.cumulativeRoundIds || [])}`}
            >
                {round?.timeLimit &&
                    resultToString(round?.timeLimit?.centiseconds || 0)}{" "}
                {round?.timeLimit?.cumulativeRoundIds?.length || 0 > 1
                    ? "(cumulative)"
                    : ""}
            </Table.Cell>
            <Table.Cell>
                {round?.cutoff && resultToString(round?.cutoff?.attemptResult)}
            </Table.Cell>
            <Table.Cell>
                {round?.advancementCondition &&
                    `Top ${round.advancementCondition.level}${round?.advancementCondition?.type === "percent" ? "%" : ""}`}
            </Table.Cell>
            <Table.Cell>
                {activity.childActivities.length === 0
                    ? ""
                    : activity.childActivities.length}
            </Table.Cell>
        </Table.Row>
    );
};

export default ScheduleRow;
