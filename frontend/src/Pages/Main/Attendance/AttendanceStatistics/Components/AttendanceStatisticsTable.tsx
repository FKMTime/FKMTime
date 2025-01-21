import { useState } from "react";

import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Switch } from "@/Components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { AttendanceStatistics } from "@/lib/interfaces";

interface AttendanceStatisticsTableProps {
    attendanceStatistics: AttendanceStatistics[];
}

const AttendanceStatisticsTable = ({
    attendanceStatistics,
}: AttendanceStatisticsTableProps) => {
    const [sortBy, setSortBy] =
        useState<keyof AttendanceStatistics>("personName");
    const [descending, setDescending] = useState(false);

    const sortedAttendanceStatistics = [...attendanceStatistics].sort(
        (a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];

            if (typeof aValue === "number" && typeof bValue === "number") {
                return aValue - bValue;
            }
            if (typeof aValue === "string" && typeof bValue === "string") {
                return aValue.localeCompare(bValue);
            }
            return 0;
        }
    );

    if (descending) {
        sortedAttendanceStatistics.reverse();
    }

    return (
        <Table>
            <TableHeader>
                <div className="flex items-center space-x-2">
                    <Select
                        onValueChange={(value) => {
                            setSortBy(value as keyof AttendanceStatistics);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="personName">Name</SelectItem>
                            <SelectItem value="presentPercentage">
                                Present Percentage
                            </SelectItem>
                            <SelectItem value="totalPresentAtStaffingComparedToRounds">
                                Total Present Staffing
                            </SelectItem>
                            <SelectItem value="totalAssignedStaffing">
                                Total Assigned Staffing
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="descending"
                            checked={descending}
                            onCheckedChange={() => setDescending(!descending)}
                        />
                        <Label htmlFor="airplane-mode">Descending</Label>
                    </div>
                </div>

                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Present Percentage</TableHead>
                    <TableHead>Total Present Staffing</TableHead>
                    <TableHead>Total Assigned Staffing</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedAttendanceStatistics.map((attendanceStatistic) => (
                    <TableRow key={attendanceStatistic.personName}>
                        <TableCell>{attendanceStatistic.personName}</TableCell>
                        <TableCell>
                            {attendanceStatistic.presentPercentage}
                        </TableCell>
                        <TableCell>
                            {
                                attendanceStatistic.totalPresentAtStaffingComparedToRounds
                            }
                        </TableCell>
                        <TableCell>
                            {attendanceStatistic.totalAssignedStaffing}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default AttendanceStatisticsTable;
