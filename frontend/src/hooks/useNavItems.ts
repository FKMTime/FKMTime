import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useDelegateAccess } from "@/hooks/useDelegateAccess";
import { competitionAtom } from "@/lib/atoms";
import { findActiveNavItem, getNavItems } from "@/lib/navigation";
import {
    isDelegate,
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { STATION_TESTER_ENABLED } from "@/lib/stationTesterEnabled";
import { loggedInWithWca } from "@/lib/utils";

/** Nav items visible to the current user, and the one owning the current path */
export const useNavItems = () => {
    const competition = useAtomValue(competitionAtom);
    const { pathname } = useLocation();
    const useFkmTimeDevices = !!competition?.useFkmTimeDevices;
    const hasDelegateAccess = useDelegateAccess().canSeeIncidents;

    const items = useMemo(
        () =>
            getNavItems({
                useFkmTimeDevices,
                isDelegate: isDelegate(),
                hasDelegateAccess,
                isOrganizerOrDelegate: isOrganizerOrDelegate(),
                isStageLeaderOrAbove: isStageLeaderOrOrganizerOrDelegate(),
                canAccessSettings: isDelegate() || !loggedInWithWca(),
                showStationTester: STATION_TESTER_ENABLED,
            }),
        [useFkmTimeDevices, hasDelegateAccess]
    );

    return {
        items,
        activeItem: findActiveNavItem(pathname, items),
        pathname,
    };
};
