import {
    chakra,
    Flex,
    Table,
    Tbody,
    Td,
    Th,
    TableHead,
    Tr,
} from "@chakra-ui/react";
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

import { AttendanceStatistics } from "@/lib/interfaces";

interface AttendanceStatisticsTableProps {
    attendanceStatistics: AttendanceStatistics[];
}

interface Meta {
    isNumeric?: boolean;
}

const AttendanceStatisticsTable = ({
    attendanceStatistics,
}: AttendanceStatisticsTableProps) => {
    const data = useMemo(() => attendanceStatistics, [attendanceStatistics]);

    const columnHelper = createColumnHelper<AttendanceStatistics>();

    const columns = [
        columnHelper.accessor("personName", {
            cell: (info) => info.getValue(),
            header: "Name",
        }),
        columnHelper.accessor("presentPercentage", {
            cell: (info) => `${info.getValue()}%`,
            header: "Present percentage",
            meta: {
                isNumeric: true,
            },
        }),
        columnHelper.accessor("totalPresentAtStaffingComparedToRounds", {
            cell: (info) => info.getValue(),
            header: "Total present staffing",
            meta: {
                isNumeric: true,
            },
        }),
        columnHelper.accessor("totalStaffingComparedToRounds", {
            cell: (info) => info.getValue(),
            header: "Total assigned staffing (from rounds that have been started)",
            meta: {
                isNumeric: true,
            },
        }),
        columnHelper.accessor("totalAssignedStaffing", {
            cell: (info) => info.getValue(),
            header: "Total assigned staffing",
            meta: {
                isNumeric: true,
            },
        }),
    ];

    const [sorting, setSorting] = useState<SortingState>([]);
    const table = useReactTable({
        columns,
        data,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
        },
    });
    return (
        <Table>
            <TableHead>
                {table.geTableHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} bg="gray.400">
                        {headerGroup.headers.map((header) => {
                            const meta: Meta = header.column.columnDef
                                .meta as Meta;
                            return (
                                <Th
                                    key={header.id}
                                    onClick={header.column.getToggleSortingHandler()}
                                    isNumeric={meta?.isNumeric}
                                >
                                    <Flex>
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        <chakra.span pl="4">
                                            {header.column.getIsSorted() ? (
                                                header.column.getIsSorted() ===
                                                "desc" ? (
                                                    <FaChevronDown aria-label="sorted descending" />
                                                ) : (
                                                    <FaChevronUp aria-label="sorted ascending" />
                                                )
                                            ) : null}
                                        </chakra.span>
                                    </Flex>
                                </TableHead>
                            );
                        })}
                    </TableRow>
                ))}
            </TableHead>
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => {
                            const meta: Meta = cell.column.columnDef
                                .meta as Meta;
                            return (
                                <TableCell key={cell.id} isNumeric={meta?.isNumeric}>
                                    {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                    )}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default AttendanceStatisticsTable;
