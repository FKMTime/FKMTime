import {
    chakra,
    Flex,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useSortBy, useTable } from "react-table";

import { AttendanceStatistics } from "@/logic/interfaces.ts";

interface AttendanceStatisticsTableProps {
    attendanceStatistics: AttendanceStatistics[];
}

const AttendanceStatisticsTable = ({
    attendanceStatistics,
}: AttendanceStatisticsTableProps) => {
    const data = useMemo(() => attendanceStatistics, [attendanceStatistics]);

    const columns = useMemo(
        () => [
            {
                Header: "Name",
                accessor: "personName",
            },
            {
                Header: "Present percentage",
                accessor: "presentPercentage",
                render: (value: number) => `${value}%`,
                isNumeric: true,
            },
            {
                Header: "Total present staffing",
                accessor: "totalPresentAtStaffingComparedToRounds",
                isNumeric: true,
            },
            {
                Header: "Total assigned staffing (from rounds that have been started)",
                accessor: "totalStaffingComparedToRounds",
                isNumeric: true,
            },
            {
                Header: "Total assigned staffing",
                accessor: "totalAssignedStaffing",
                isNumeric: true,
            },
        ],
        []
    );

    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
        //eslint-disable-next-line
        //@ts-ignore
        useTable({ columns, data }, useSortBy);
    return (
        <Table {...getTableProps()}>
            <Thead>
                {headerGroups.map((headerGroup) => (
                    <Tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map((column) => {
                            //eslint-disable-next-line
                            //@ts-ignore
                            const isSorted = column.isSorted;
                            //eslint-disable-next-line
                            //@ts-ignore
                            const isSortedDesc = column.isSortedDesc;
                            return (
                                <Th
                                    backgroundColor="gray.400"
                                    {...column.getHeaderProps(
                                        //eslint-disable-next-line
                                        // @ts-ignore
                                        column.getSortByToggleProps()
                                    )}
                                >
                                    <Flex>
                                        {column.render("Header")}
                                        <chakra.span pl="4">
                                            {isSorted ? (
                                                isSortedDesc ? (
                                                    <FaChevronDown aria-label="sorted descending" />
                                                ) : (
                                                    <FaChevronUp aria-label="sorted ascending" />
                                                )
                                            ) : null}
                                        </chakra.span>
                                    </Flex>
                                </Th>
                            );
                        })}
                    </Tr>
                ))}
            </Thead>
            <Tbody {...getTableBodyProps()}>
                {rows.map((row) => {
                    prepareRow(row);
                    return (
                        <Tr {...row.getRowProps()}>
                            {row.cells.map((cell) => (
                                <Td {...cell.getCellProps()}>
                                    {cell.render("Cell")}
                                </Td>
                            ))}
                        </Tr>
                    );
                })}
            </Tbody>
        </Table>
    );
};

export default AttendanceStatisticsTable;
