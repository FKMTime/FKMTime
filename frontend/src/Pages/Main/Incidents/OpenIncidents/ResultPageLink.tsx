import { Link } from "react-router-dom";

import { DelegateAccess } from "@/hooks/useDelegateAccess";
import { DelegateGrantPermission } from "@/lib/delegateGrants";

/** What can only be done on the result page, not in the incident panel */
const RESULT_PAGE_PERMISSIONS: DelegateGrantPermission[] = [
    "ADD_ATTEMPT",
    "REORDER_ATTEMPTS",
    "EDIT_ATTEMPT",
    "DELETE_ATTEMPT",
    "EXTRAS_FOR_SEVERAL",
    "DNF_ALL",
];

interface ResultPageLinkProps {
    resultId: string;
    can: DelegateAccess["can"];
}

/**
 * The way to the result page from an incident. A user with access for a group
 * has no other link to it, so it shows whenever the grant includes something
 * done there.
 */
const ResultPageLink = ({ resultId, can }: ResultPageLinkProps) => {
    if (!RESULT_PAGE_PERMISSIONS.some((permission) => can(permission)))
        return null;
    return (
        <Link
            to={`/results/${resultId}`}
            className="text-sm font-semibold text-primary hover:underline"
        >
            {can("EXTRAS_FOR_SEVERAL")
                ? "Several attempts affected? Give extras on the result page"
                : "Open result"}
        </Link>
    );
};

export default ResultPageLink;
