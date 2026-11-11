import { TriangleAlert } from "lucide-react";

import { Incident } from "@/lib/interfaces";

interface PreviousExtrasProps {
    previousIncidents: Incident[];
}

/** Earlier extras this competitor got, grouped by reason */
const PreviousExtras = ({ previousIncidents }: PreviousExtrasProps) => {
    if (previousIncidents.length === 0) return null;

    const counts = new Map<string, number>();
    for (const incident of previousIncidents) {
        const reason = incident.comment || "No comment";
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }

    return (
        <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-warning"
        >
            <TriangleAlert className="mt-px size-[18px] shrink-0" />
            <div>
                <span className="font-semibold">Previous extras: </span>
                {[...counts]
                    .map(([reason, count]) =>
                        count === 1 ? reason : `${reason} (${count} times)`
                    )
                    .join(", ")}
            </div>
        </div>
    );
};

export default PreviousExtras;
