import { ChevronLeft } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePageHeader } from "@/hooks/usePageHeader";
import { activityCodeToName } from "@/lib/activities";
import { getEventIconClass } from "@/lib/events";
import { cn, shortRoundName } from "@/lib/utils";

interface RoundSubpageHeaderProps {
    roundId: string;
    title: string;
    /** Right-hand side, e.g. progress or actions */
    aside?: ReactNode;
    /** Where "back" goes; the round's results by default */
    backTo?: string;
}

/** Back to the round, page title and round name for round sub-pages */
const RoundSubpageHeader = ({
    roundId,
    title,
    aside,
    backTo = `/results/round/${roundId}`,
}: RoundSubpageHeaderProps) => {
    usePageHeader({
        crumbs: [
            { label: "Results", to: "/results" },
            { label: shortRoundName(roundId), to: backTo },
            { label: title },
        ],
        title,
        subtitle: shortRoundName(roundId),
        backTo,
    });

    return (
        <div className="flex flex-col gap-2">
            <Link
                to={backTo}
                className="-ml-1.5 hidden w-fit items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
            >
                <ChevronLeft className="size-4" />
                {shortRoundName(roundId)}
            </Link>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon",
                                getEventIconClass(roundId.split("-")[0])
                            )}
                        />
                        {activityCodeToName(roundId).replace(", ", " · ")}
                    </p>
                </div>
                {aside}
            </div>
        </div>
    );
};

export default RoundSubpageHeader;
