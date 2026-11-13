import { RoundMeta } from "@/lib/roundInfo";
import { cn } from "@/lib/utils";

interface RoundMetaLineProps {
    meta: RoundMeta | null;
    advancement?: string | null;
    className?: string;
}

/** Format, time limit, cutoff and who proceeds: "Average of 5 · Time limit 10:00.00" */
const RoundMetaLine = ({
    meta,
    advancement,
    className,
}: RoundMetaLineProps) => (
    <div
        className={cn(
            "flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted-foreground",
            className
        )}
    >
        {meta?.format && <span>{meta.format}</span>}
        {meta?.timeLimit && (
            <span>
                Time limit{" "}
                <b className="font-semibold text-foreground">
                    {meta.timeLimit}
                </b>
            </span>
        )}
        {meta?.cutoff && (
            <span>
                Cutoff{" "}
                <b className="font-semibold text-foreground">{meta.cutoff}</b>
            </span>
        )}
        {advancement && <span>{advancement}</span>}
    </div>
);

export default RoundMetaLine;
