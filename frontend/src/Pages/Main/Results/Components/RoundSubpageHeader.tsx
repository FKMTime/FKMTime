import { ReactNode } from "react";

import { usePageHeader } from "@/hooks/usePageHeader";
import { roundName } from "@/lib/roundOptions";

interface RoundSubpageHeaderProps {
    roundId: string;
    title: string;
    /** Right-hand side, e.g. progress or actions */
    aside?: ReactNode;
    /** Where "back" goes; the round's results by default */
    backTo?: string;
}

/**
 * Round sub-pages are named by the shell: breadcrumbs with the round on
 * desktop, title and back button on phones. Only the aside renders here.
 */
const RoundSubpageHeader = ({
    roundId,
    title,
    aside,
    backTo = `/results/round/${roundId}`,
}: RoundSubpageHeaderProps) => {
    usePageHeader({
        crumbs: [
            { label: "Results", to: "/results" },
            {
                label: roundName(roundId),
                to: backTo,
                eventId: roundId.split("-")[0],
            },
            { label: title },
        ],
        title,
        subtitle: roundName(roundId),
        subtitleEventId: roundId.split("-")[0],
        backTo,
    });

    if (!aside) return null;
    return (
        <div className="flex flex-wrap items-end justify-end gap-3">
            {aside}
        </div>
    );
};

export default RoundSubpageHeader;
