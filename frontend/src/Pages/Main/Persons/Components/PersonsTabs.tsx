import { atom, useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { competitionAtom } from "@/lib/atoms";
import { checkedInCount, getPersonsWithoutCardAssigned } from "@/lib/persons";

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
