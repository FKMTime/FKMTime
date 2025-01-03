import { chakra, Flex, Table } from "@chakra-ui/react";
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

import { AttendanceStatistics } from "@/logic/interfaces.ts";

interface AttendanceStatisticsTableProps {
    attendanceStatistics: AttendanceStatistics[];
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
        <Table.Root>
            <Table.Header>
                {table.getHeaderGroups().map((headerGroup) => (
                    <Table.Row key={headerGroup.id} bg="gray.400">
                        {headerGroup.headers.map((header) => {
                            return (
                                <Table.ColumnHeader
                                    key={header.id}
                                    onClick={header.column.getToggleSortingHandler()}
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
                                </Table.ColumnHeader>
                            );
                        })}
                    </Table.Row>
                ))}
            </Table.Header>
            <Table.Body>
                {table.getRowModel().rows.map((row) => (
                    <Table.Row key={row.id}>
                        {row.getVisibleCells().map((cell) => {
                            return (
                                <Table.Cell key={cell.id}>
                                    {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                    )}
                                </Table.Cell>
                            );
                        })}
                    </Table.Row>
                ))}
            </Table.Body>
        </Table.Root>
    );
};

export default AttendanceStatisticsTable;
