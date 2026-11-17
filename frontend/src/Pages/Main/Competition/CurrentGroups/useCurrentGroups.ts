import { useQueries } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    competitionSettingsQuery,
    getCompetitionInfo,
    nextGroupsQuery,
    updateCompetitionSettings,
} from "@/lib/competition";
import { getStartedRounds } from "@/lib/currentGroups";
import { isUnofficialEvent } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { fetchQuery, toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { roomsProgressQuery, roomsQuery, updateRoomGroups } from "@/lib/rooms";

/** Re-render this often so "N min behind" stays current */
const CLOCK_TICK_MS = 30_000;

const invalidatePaths = (matches: (path: string) => boolean) =>
    void queryClient.invalidateQueries({
        predicate: ({ queryKey: [path] }) =>
            typeof path === "string" && matches(path),
    });

const refreshRooms = () =>
    invalidatePaths(
        (path) =>
            path === roomsQuery.key ||
            path === roomsProgressQuery.key ||
            (path.startsWith("competition/rooms/") &&
                path.endsWith("/next-groups"))
    );

const refreshProgress = () =>
    invalidatePaths((path) => path === roomsProgressQuery.key);

/**
 * The rooms with their running groups, progress and next groups, kept live:
 * results refresh the progress, and the backend's own group changes refresh
 * the rooms.
 */
export const useCurrentGroups = () => {
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const { data: rooms } = useLiveQuery(roomsQuery);
    const { data: progress } = useLiveQuery(roomsProgressQuery);
    // The panel's competition doesn't carry the setting; the settings do
    const { data: settings } = useLiveQuery(competitionSettingsQuery);
    const [now, setNow] = useState(() => new Date());
    const [isAutoChangeSaving, setIsAutoChangeSaving] = useState(false);
    const [startedRounds, setStartedRounds] = useState<string[]>([]);

    useEffect(() => {
        if (!competition)
            getCompetitionInfo().then((response) =>
                setCompetition(response.data)
            );
    }, [competition, setCompetition]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
        return () => clearInterval(interval);
    }, []);

    useSocketEvents({
        resultEntered: refreshProgress,
        // Sent when the backend changes a room's groups by itself
        groupShouldBeChanged: refreshRooms,
    });

    const sortedRooms = useMemo(
        () => [...(rooms ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
        [rooms]
    );

    const nextGroups = useQueries({
        queries: sortedRooms.map((room) =>
            toQueryOptions(nextGroupsQuery(room.id))
        ),
        combine: (results): Record<string, string[]> =>
            Object.fromEntries(
                sortedRooms.flatMap((room, index) =>
                    results[index]?.data ? [[room.id, results[index].data]] : []
                )
            ),
    });

    const roundIds = useMemo(
        () => [
            ...new Set(
                sortedRooms.flatMap((room) =>
                    room.currentGroupIds.map((id) => id.split("-g")[0])
                )
            ),
        ],
        [sortedRooms]
    );

    const getProgress = (roomId: string, groupId: string) =>
        progress
            ?.find((p) => p.roomId === roomId)
            ?.groups.find((g) => g.groupId === groupId);

    const setRoomGroups = async (room: Room, groupIds: string[]) => {
        const response = await updateRoomGroups(room, groupIds);
        if (response.status === 200) {
            setStartedRounds(
                getStartedRounds(
                    sortedRooms,
                    sortedRooms.map((r) =>
                        r.id === room.id
                            ? { ...r, currentGroupIds: groupIds }
                            : r
                    ),
                    isUnofficialEvent
                )
            );
            toast({ title: `${room.name} updated`, variant: "success" });
            refreshRooms();
            return true;
        }
        toast({
            title: response.data?.message ?? "Something went wrong!",
            variant: "destructive",
        });
        return false;
    };

    const setAutoChange = async (value: boolean) => {
        if (!competition) return;
        setIsAutoChangeSaving(true);
        const fresh = await fetchQuery(competitionSettingsQuery);
        const status = await updateCompetitionSettings(competition.id, {
            ...fresh,
            shouldChangeGroupsAutomatically: value,
        });
        setIsAutoChangeSaving(false);
        if (status === 200) {
            void queryClient.invalidateQueries({
                queryKey: [competitionSettingsQuery.key],
            });
            toast({
                title: value
                    ? "Groups change automatically"
                    : "Groups change only by hand",
                variant: "success",
            });
        } else {
            toast({ title: "Something went wrong!", variant: "destructive" });
        }
    };

    return {
        competition,
        rooms: sortedRooms,
        isLoading: !competition || !rooms,
        nextGroups,
        roundIds,
        getProgress,
        now,
        setRoomGroups,
        /** Official rounds the last change started, to open in WCA Live */
        startedRounds,
        clearStartedRounds: () => setStartedRounds([]),
        isAutoChange: !!settings?.shouldChangeGroupsAutomatically,
        isAutoChangeKnown: !!settings,
        isAutoChangeSaving,
        setAutoChange,
    };
};
