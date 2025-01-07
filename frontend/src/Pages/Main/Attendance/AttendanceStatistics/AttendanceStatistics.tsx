import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { getAttendanceStatistics } from "@/lib/attendance";
import { AttendanceStatistics as AttendanceStatisticsType } from "@/lib/interfaces";
import AttendanceStatisticsTable from "@/Pages/Main/Attendance/AttendanceStatistics/Components/AttendanceStatisticsTable";

const AttendanceStatistics = () => {
    const [statistics, setStatistics] = useState<AttendanceStatisticsType[]>(
        []
    );

    useEffect(() => {
        getAttendanceStatistics().then((data) => {
            setStatistics(data);
        });
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Attendance statistics</CardTitle>
            </CardHeader>
            <CardContent>
                <AttendanceStatisticsTable attendanceStatistics={statistics} />
            </CardContent>
        </Card>
    );
};
export default AttendanceStatistics;
