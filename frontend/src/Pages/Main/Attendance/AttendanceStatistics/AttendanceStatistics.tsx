import { Box, Heading } from "@chakra-ui/react";
import { useEffect, useState } from "react";

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
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Attendance statistics</Heading>
            <AttendanceStatisticsTable attendanceStatistics={statistics} />
        </Box>
    );
};
export default AttendanceStatistics;
