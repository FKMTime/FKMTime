import { Box, IconButton, Text } from "@chakra-ui/react";
import { ChangeEvent } from "react";
import {
    FaAngleDoubleLeft,
    FaAngleDoubleRight,
    FaAngleLeft,
    FaAngleRight,
} from "react-icons/fa";

import Select from "@/Components/Select";

interface PaginationProps {
    page: number;
    totalPages: number;
    handlePageChange: (page: number) => void;
    changePageSize: (pageSize: number) => void;
    pageSize: number;
}

const Pagination = ({
    page,
    totalPages,
    handlePageChange,
    changePageSize,
    pageSize,
}: PaginationProps) => {
    const handlePageChangeWrapper = (pageParam: number) => {
        if (pageParam < 1) {
            handlePageChange(1);
        } else if (pageParam > totalPages) {
            handlePageChange(totalPages);
        } else {
            handlePageChange(pageParam);
        }
    };

    const handlePageSizeChange = (e: ChangeEvent<HTMLSelectElement>) => {
        changePageSize(parseInt(e.target.value));
    };
    return (
        <Box display="flex" flexDirection="column">
            {totalPages > 1 && (
                <Box
                    display="flex"
                    flexDirection="row"
                    gap={3}
                    color="white"
                    alignItems="center"
                    justifyContent="center"
                    width="100%"
                    textAlign="center"
                >
                    <IconButton
                        onClick={() => handlePageChangeWrapper(1)}
                        aria-label="Previous page"
                        disabled={page === 1}
                    >
                        <FaAngleDoubleLeft />
                    </IconButton>
                    <IconButton
                        onClick={() => handlePageChangeWrapper(page - 1)}
                        aria-label="First page"
                        disabled={page === 1}
                    >
                        <FaAngleLeft />
                    </IconButton>
                    <Text>
                        Page {page} of {totalPages}
                    </Text>
                    <IconButton
                        onClick={() => handlePageChangeWrapper(page + 1)}
                        aria-label="Next page"
                        disabled={page === totalPages}
                    >
                        <FaAngleRight />
                    </IconButton>
                    <IconButton
                        onClick={() => handlePageChangeWrapper(totalPages)}
                        aria-label="Last page"
                        disabled={page === totalPages}
                    >
                        <FaAngleDoubleRight />
                    </IconButton>
                </Box>
            )}
            {totalPages !== 0 && (
                <Box width={{ base: "30%", md: "5%" }} margin="auto" mt="5">
                    <Select
                        value={pageSize.toString()}
                        onChange={handlePageSizeChange}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </Select>
                </Box>
            )}
        </Box>
    );
};

export default Pagination;
