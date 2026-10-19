import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import { Crumb } from "@/lib/navigation";

interface BreadcrumbsProps {
    crumbs: Crumb[];
}

/** The last crumb is the page heading; earlier ones link back up */
const Breadcrumbs = ({ crumbs }: BreadcrumbsProps) => (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            if (isLast)
                return (
                    <h1
                        key={index}
                        className="min-w-0 truncate text-[15px] font-semibold"
                    >
                        {crumb.label}
                    </h1>
                );
            return (
                <Fragment key={index}>
                    {crumb.to ? (
                        <Link
                            to={crumb.to}
                            className="-ml-1.5 shrink-0 whitespace-nowrap rounded-md px-1.5 py-1 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">
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
