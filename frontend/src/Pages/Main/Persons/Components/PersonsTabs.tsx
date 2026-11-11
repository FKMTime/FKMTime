import { atom, useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { competitionAtom } from "@/lib/atoms";
import {
    checkedInCount,
    firstPersonsPageQuery,
    getPersonsWithoutCardAssigned,
    personsWithoutCardQuery,
} from "@/lib/persons";
import { LIVE_MAX_AGE, prefetchQuery } from "@/lib/queryCache";

interface PersonsTabsProps {
    value: "all" | "cards";
    /** Bump to re-fetch the counts after assigning cards or adding people */
    refreshKey?: number;
}

// Outlives the tab switch, so the counts stay on screen while they reload
const countsAtom = atom<{ total?: number; withoutCard?: number }>({});

/** All persons / Assign cards; card assignment needs FKMTime devices */
const PersonsTabs = ({ value, refreshKey }: PersonsTabsProps) => {
    const competition = useAtomValue(competitionAtom);
    const [{ total, withoutCard }, setCounts] = useAtom(countsAtom);
    const useDevices = !!competition?.useFkmTimeDevices;

    useEffect(() => {
        checkedInCount().then((data) =>
            setCounts((counts) => ({
                ...counts,
                total: data.totalPersonsCount,
            }))
        );
        if (useDevices)
            getPersonsWithoutCardAssigned().then((data) =>
                setCounts((counts) => ({ ...counts, withoutCard: data.count }))
            );
    }, [useDevices, refreshKey, setCounts]);

    // Load the other tab's list, so switching doesn't wait
    useEffect(() => {
        if (!useDevices) return;
        const options = { maxAge: LIVE_MAX_AGE };
        if (value === "all") prefetchQuery(personsWithoutCardQuery, options);
        else prefetchQuery(firstPersonsPageQuery, options);
    }, [value, useDevices]);

    if (!useDevices) return null;

    return (
        <PageTabs
            label="Persons"
            value={value}
            tabs={[
                {
                    value: "all",
                    label: "All persons",
                    count: total,
                    to: "/persons",
                },
                {
                    value: "cards",
                    label: "Assign cards",
                    count: withoutCard,
                    to: "/cards",
                },
            ]}
            className="max-md:-mt-4 max-md:bg-card"
        />
    );
};

export default PersonsTabs;
