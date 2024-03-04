import { Box, IconButton, Select, Text } from "@chakra-ui/react";
import {
    FaAngleDoubleLeft,
    FaAngleDoubleRight,
    FaAngleLeft,
    FaAngleRight,
} from "react-icons/fa";

interface PaginationProps {
    page: number;
    totalPages: number;
    handlePageChange: (page: number) => void;
    changePageSize: (pageSize: number) => void;
    pageSize: number;
}

const Pagination: React.FC<PaginationProps> = ({
    page,
    totalPages,
    handlePageChange,
    changePageSize,
    pageSize,
}): JSX.Element => {
    const handlePageChangeWrapper = (page: number) => {
        if (page < 1) {
            handlePageChange(1);
        } else if (page > totalPages) {
            handlePageChange(totalPages);
        } else {
            handlePageChange(page);
        }
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
                        icon={<FaAngleDoubleLeft />}
                        onClick={() => handlePageChangeWrapper(page - 1)}
                        aria-label="Previous page"
                        isDisabled={page === 1}
                    />
                    <IconButton
                        icon={<FaAngleLeft />}
                        onClick={() => handlePageChangeWrapper(1)}
                        aria-label="First page"
                        isDisabled={page === 1}
                    />
                    <Text>
                        Page {page} of {totalPages}
                    </Text>
                    <IconButton
                        icon={<FaAngleRight />}
                        onClick={() => handlePageChangeWrapper(page + 1)}
                        aria-label="Next page"
                        isDisabled={page === totalPages}
                    />
                    <IconButton
                        icon={<FaAngleDoubleRight />}
                        onClick={() => handlePageChangeWrapper(totalPages)}
                        aria-label="Last page"
                        isDisabled={page === totalPages}
                    />
                </Box>
            )}
            {totalPages !== 0 && (
                <Box width="5%" margin="auto" mt="5">
                    <Select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        _placeholder={{ color: "white" }}
                        color="white"
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
