/** What both group picker layouts derive from their props */
import { useMemo } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { GroupProgress } from "@/lib/rooms";
import { findGroupSchedule } from "@/lib/schedule";

import {
    getPickerEvents,
    PickerRoom,
    UsePickerStepsOptions,
} from "./pickerModel";

export interface PickerProps {
    wcif: WCIF;
    room: PickerRoom;
    rooms: PickerRoom[];
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined;
    /** The room's next groups by schedule; the first is suggested */
    nextGroupIds: string[];
    onPick: (groupId: string) => void;
    onCancel: () => void;
}

export const usePickerContext = ({
    wcif,
    room,
    rooms,
    getProgress,
    nextGroupIds,
    onPick,
    onCancel,
}: PickerProps) => {
    const events = useMemo(
        () => getPickerEvents(wcif, room.name),
        [wcif, room.name]
    );
    const timezone = wcif.schedule.venues[0]?.timezone;
    const suggestedId = nextGroupIds.find(
        (id) => !room.currentGroupIds.includes(id)
    );
    const suggestion = suggestedId
        ? {
              groupId: suggestedId,
              startTime: findGroupSchedule(wcif, suggestedId, room.name)
                  ?.startTime,
          }
        : undefined;
    const stepOptions: UsePickerStepsOptions = {
        wcif,
        room,
        rooms,
        getProgress,
        onPick,
        onCancel,
    };
    return { events, timezone, suggestion, stepOptions };
};
