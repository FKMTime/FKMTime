import { Link } from "react-router-dom";

interface ResultPageLinkProps {
    resultId: string;
    /** Extras for several attempts are given on the result page */
    canGiveExtrasForSeveral: boolean;
}

/**
 * The way to the incident's result. Whoever can open the incident can open
 * its result, and a user with access for a group has no other link to it.
 * The result page shows only the actions their grant includes.
 */
const ResultPageLink = ({
    resultId,
    canGiveExtrasForSeveral,
}: ResultPageLinkProps) => (
    <Link
        to={`/results/${resultId}`}
        className="text-sm font-semibold text-primary hover:underline"
    >
        {canGiveExtrasForSeveral
            ? "Several attempts affected? Give extras on the result page"
            : "Open result"}
    </Link>
);

export default ResultPageLink;
