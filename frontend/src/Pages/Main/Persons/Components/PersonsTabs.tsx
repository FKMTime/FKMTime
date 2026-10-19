import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { competitionAtom } from "@/lib/atoms";
import { checkedInCount, getPersonsWithoutCardAssigned } from "@/lib/persons";

interface PersonsTabsProps {
    value: "all" | "cards";
    /** Bump to re-fetch the counts after assigning cards or adding people */
    refreshKey?: number;
}

/** All persons / Assign cards; card assignment needs FKMTime devices */
const PersonsTabs = ({ value, refreshKey }: PersonsTabsProps) => {
    const competition = useAtomValue(competitionAtom);
    const [total, setTotal] = useState<number>();
    const [withoutCard, setWithoutCard] = useState<number>();
    const useDevices = !!competition?.useFkmTimeDevices;

    useEffect(() => {
        checkedInCount().then((data) => setTotal(data.totalPersonsCount));
        if (useDevices)
            getPersonsWithoutCardAssigned().then((data) =>
                setWithoutCard(data.count)
            );
    }, [useDevices, refreshKey]);

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
