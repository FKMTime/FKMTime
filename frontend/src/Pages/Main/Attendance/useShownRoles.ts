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
 * Which role cards Attendance shows, remembered on this device. At least
 * one role always stays on, so the page never goes blank.
 */
export const useShownRoles = <T extends string>(allRoles: readonly T[]) => {
    const [shown, setShown] = useState<T[]>(() => read(allRoles));

    useEffect(() => {
        localStorage.setItem(
            ATTENDANCE_ROLES_STORAGE_KEY,
            JSON.stringify(shown)
        );
    }, [shown]);

    const toggle = (role: T) =>
        setShown((current) => {
            if (!current.includes(role))
                return allRoles.filter(
                    (r) => r === role || current.includes(r)
                );
            return current.length > 1
                ? current.filter((r) => r !== role)
                : current;
        });

    return { shown, toggle };
};
