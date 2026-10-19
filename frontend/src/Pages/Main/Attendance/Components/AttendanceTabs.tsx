import { useEffect, useState } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { getMostMissedAssignments } from "@/lib/attendance";

interface AttendanceTabsProps {
    value: "groups" | "missed" | "statistics";
}

const AttendanceTabs = ({ value }: AttendanceTabsProps) => {
    const [missedCount, setMissedCount] = useState<number>();

    useEffect(() => {
        getMostMissedAssignments().then((data) => setMissedCount(data.length));
    }, []);

    return (
        <PageTabs
            label="Attendance"
            value={value}
            tabs={[
                { value: "groups", label: "Groups", to: "/attendance" },
                {
                    value: "missed",
                    label: "Most missed",
                    count: missedCount,
                    to: "/attendance/missed",
                },
                {
                    value: "statistics",
                    label: "Statistics",
                    to: "/attendance/statistics",
                },
            ]}
            className="max-md:-mt-4 max-md:bg-card"
        />
    );
};

export default AttendanceTabs;
