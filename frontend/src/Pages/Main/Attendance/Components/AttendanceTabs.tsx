import { useEffect } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import {
    attendanceStatisticsQuery,
    mostMissedAssignmentsQuery,
} from "@/lib/attendance";
import { LIVE_MAX_AGE, prefetchQuery } from "@/lib/queryCache";

interface AttendanceTabsProps {
    value: "groups" | "missed" | "statistics";
}

const AttendanceTabs = ({ value }: AttendanceTabsProps) => {
    // Loading the list for its count also fills the Most missed tab
    const { data: missed } = useCachedQuery(mostMissedAssignmentsQuery);
    const missedCount = missed?.length;

    useEffect(() => {
        prefetchQuery(attendanceStatisticsQuery, { maxAge: LIVE_MAX_AGE });
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
