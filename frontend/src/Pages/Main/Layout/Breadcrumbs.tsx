import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import { getEventIconClass } from "@/lib/events";
import { Crumb } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
    crumbs: Crumb[];
}

const CrumbIcon = ({ eventId }: { eventId?: string }) =>
    eventId ? (
        <span
            aria-hidden
            className={cn(
                "cubing-icon shrink-0 text-lg",
                getEventIconClass(eventId)
            )}
        />
    ) : null;

/** The last crumb is the page heading; earlier ones link back up */
const Breadcrumbs = ({ crumbs }: BreadcrumbsProps) => (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            if (isLast)
                return (
                    <h1
                        key={index}
                        className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[15px] font-semibold"
                    >
                        <CrumbIcon eventId={crumb.eventId} />
                        {crumb.label}
                    </h1>
                );
            return (
                <Fragment key={index}>
                    {crumb.to ? (
                        <Link
                            to={crumb.to}
                            className={cn(
                                "-ml-1.5 flex items-center gap-2 whitespace-nowrap rounded-md px-1.5 py-1 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                                // A long round name gives way; short crumbs keep their width
                                crumb.eventId ? "min-w-0" : "shrink-0"
                            )}
                        >
                            <CrumbIcon eventId={crumb.eventId} />
                            <span className="truncate">{crumb.label}</span>
                        </Link>
                    ) : (
                        <span className="min-w-0 truncate whitespace-nowrap text-[15px] font-medium text-muted-foreground">
                            {crumb.label}
                        </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-faint" />
                </Fragment>
            );
        })}
    </nav>
);

export default Breadcrumbs;
