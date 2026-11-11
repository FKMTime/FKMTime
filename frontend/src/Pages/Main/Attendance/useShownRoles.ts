import { useEffect, useState } from "react";

export const ATTENDANCE_ROLES_STORAGE_KEY = "fkmtime-attendance-roles";

const read = <T extends string>(allRoles: readonly T[]): T[] => {
    try {
        const saved = JSON.parse(
            localStorage.getItem(ATTENDANCE_ROLES_STORAGE_KEY) ?? "null"
        );
        if (Array.isArray(saved)) {
            const known = allRoles.filter((role) => saved.includes(role));
            if (known.length > 0) return known;
        }
    } catch {
        // Unreadable; fall back to every role
    }
    return [...allRoles];
};

/**
 * Which role cards Attendance shows, remembered on this device. A role
 * nobody holds in the group stays hidden until it is turned on for that
 * group. At least one role always stays on, so the page never goes blank.
 */
export const useShownRoles = <T extends string>(
    allRoles: readonly T[],
    groupId: string,
    emptyRoles: readonly T[]
) => {
    const [saved, setSaved] = useState<T[]>(() => read(allRoles));
    // Empty roles turned on for one group; forgotten when the group changes
    const [revealed, setRevealed] = useState<{ groupId: string; roles: T[] }>({
        groupId,
        roles: [],
    });
    const revealedRoles = revealed.groupId === groupId ? revealed.roles : [];

    useEffect(() => {
        localStorage.setItem(
            ATTENDANCE_ROLES_STORAGE_KEY,
            JSON.stringify(saved)
        );
    }, [saved]);

    const isEmpty = (role: T) =>
        emptyRoles.includes(role) && !revealedRoles.includes(role);
    const withPeople = saved.filter((role) => !isEmpty(role));
    const shown = withPeople.length > 0 ? withPeople : saved;

    const toggle = (role: T) => {
        if (shown.includes(role)) {
            if (shown.length === 1) return;
            if (emptyRoles.includes(role))
                setRevealed({
                    groupId,
                    roles: revealedRoles.filter((r) => r !== role),
                });
            else setSaved((current) => current.filter((r) => r !== role));
            return;
        }
        setSaved((current) =>
            allRoles.filter((r) => r === role || current.includes(r))
        );
        if (emptyRoles.includes(role))
            setRevealed({ groupId, roles: [...revealedRoles, role] });
    };

    return { shown, toggle };
};
