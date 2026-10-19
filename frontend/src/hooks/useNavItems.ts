import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { competitionAtom } from "@/lib/atoms";
import { findActiveNavItem, getNavItems } from "@/lib/navigation";
import {
    isDelegate,
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { loggedInWithWca } from "@/lib/utils";

/** Nav items visible to the current user, and the one owning the current path */
export const useNavItems = () => {
    const competition = useAtomValue(competitionAtom);
    const { pathname } = useLocation();
    const useFkmTimeDevices = !!competition?.useFkmTimeDevices;

    const items = useMemo(
        () =>
            getNavItems({
                useFkmTimeDevices,
                isDelegate: isDelegate(),
                isOrganizerOrDelegate: isOrganizerOrDelegate(),
                isStageLeaderOrAbove: isStageLeaderOrOrganizerOrDelegate(),
                canAccessSettings: isDelegate() || !loggedInWithWca(),
            }),
        [useFkmTimeDevices]
    );

    return {
        items,
        activeItem: findActiveNavItem(pathname, items),
        pathname,
    };
};
