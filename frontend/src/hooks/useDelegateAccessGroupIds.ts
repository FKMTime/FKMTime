import { useQueries } from "@tanstack/react-query";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { nextGroupsQuery } from "@/lib/competition";
import { toQueryOptions } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";

/**
 * Groups delegate access can be given for outside a room's card: every
 * group running now, then each room's next one (SPEC-013). Empty while
 * loading, or for anyone but a delegate (`enabled` false).
 */
export const useDelegateAccessGroupIds = (enabled = true) => {
    const { data: rooms } = useLiveQuery(roomsQuery, { enabled });
    const nextGroupIds = useQueries({
        queries: (enabled ? rooms ?? [] : []).map((room) =>
            toQueryOptions(nextGroupsQuery(room.id))
        ),
        combine: (results) => results.flatMap((result) => result.data ?? []),
    });
    const running = (rooms ?? []).flatMap((room) => room.currentGroupIds);
    return enabled ? [...new Set([...running, ...nextGroupIds])] : [];
};
