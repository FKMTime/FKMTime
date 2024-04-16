import { Box, Heading } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { getAttendanceStatistics } from "@/logic/attendance.ts";
import { AttendanceStatistics as AttendanceStatisticsType } from "@/logic/interfaces.ts";
import AttendanceStatisticsTable from "@/Pages/Attendance/AttendanceStatistics/Components/AttendanceStatisticsTable.tsx";

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
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Attendance statistics</Heading>
            <AttendanceStatisticsTable attendanceStatistics={statistics} />
        </Box>
    );
};
export default AttendanceStatistics;
