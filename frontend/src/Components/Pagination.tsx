import {
    ArrowLeft,
    ArrowRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";

import IconButton from "./IconButton";

interface PaginationProps {
    page: number;
    totalPages: number;
    handlePageChange: (page: number) => void;
}

const Pagination = ({
    page,
    totalPages,
    handlePageChange,
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

    return (
        <div className="flex flex-col pt-5">
            {totalPages > 1 && (
                <div className="flex flex-row gap-3 items-center justify-center w-full">
                    <IconButton
                        icon={<ChevronsLeft />}
                        onClick={() => handlePageChangeWrapper(1)}
                        aria-label="Previous page"
                        disabled={page === 1}
                    />
                    <IconButton
                        icon={<ArrowLeft />}
                        onClick={() => handlePageChangeWrapper(page - 1)}
                        aria-label="First page"
                        disabled={page === 1}
                    />
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <IconButton
                        icon={<ArrowRight />}
                        onClick={() => handlePageChangeWrapper(page + 1)}
                        aria-label="Next page"
                        disabled={page === totalPages}
                    />
                    <IconButton
                        icon={<ChevronsRight />}
                        onClick={() => handlePageChangeWrapper(totalPages)}
                        aria-label="Last page"
                        disabled={page === totalPages}
                    />
                </div>
            )}
        </div>
    );
};

export default Pagination;
