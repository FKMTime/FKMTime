import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { attendanceScopeQuery } from "@/lib/attendance";
import {
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";

/**
 * The rooms and groups a stage lead takes attendance in (SPEC-016).
 * Organizers, delegates, admins and stage leads with all rooms get null:
 * everything. Until the scope arrives everything shows too; the server
 * refuses what isn't theirs anyway.
 */
export const useAttendanceScope = () => {
    const mightBeScoped =
        isStageLeaderOrOrganizerOrDelegate() && !isOrganizerOrDelegate();
    const { data } = useLiveQuery(attendanceScopeQuery, {
        enabled: mightBeScoped,
    });
    const scope = mightBeScoped && data?.allRooms === false ? data : null;

    return useMemo(() => {
        const groupIds = scope ? new Set(scope.groupIds) : null;
        const roomIds = scope
            ? new Set(scope.rooms.map((room) => room.id))
            : null;
        return {
            /** The stage lead's rooms; null for all rooms */
            rooms: scope?.rooms ?? null,
            groupIds,
            hasGroup: (groupId: string) => !groupIds || groupIds.has(groupId),
            hasRoom: (roomId: string) => !roomIds || roomIds.has(roomId),
        };
    }, [scope]);
};
