import {
    ClipboardCheck,
    Eye,
    NotebookPen,
    Plus,
    RotateCcw,
    Send,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import RowActions from "@/Components/shared/RowActions";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { getEventIconClass } from "@/lib/events";
import { reSubmitRoundToWcaLive } from "@/lib/results";
import { RoundMeta } from "@/lib/roundInfo";
import { cn, getSubmissionPlatformName } from "@/lib/utils";

interface RoundHeaderProps {
    roundId: string;
    meta: RoundMeta | null;
    advancement?: string | null;
    hasResults: boolean;
    onEnterAttempt: () => void;
    onRestartGroup: () => void;
}

const RoundHeader = ({
    roundId,
    meta,
    advancement,
    hasResults,
    onEnterAttempt,
    onRestartGroup,
}: RoundHeaderProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const eventId = roundId.split("-")[0];
    const platform = getSubmissionPlatformName(eventId);

    const handleResubmit = () => {
        confirm({
            title: `Resubmit results to ${platform}?`,
            description: `This overrides the round's results on ${platform}.`,
            confirmLabel: "Resubmit",
            variant: "default",
            onConfirm: async () => {
                const status = await reSubmitRoundToWcaLive(roundId);
                if (status === 200) {
                    toast({
                        title: `Results resubmitted to ${platform}`,
                        variant: "success",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);
    };

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                <h2 className="flex items-center gap-2.5 text-xl font-bold leading-tight">
                    <span
                        aria-hidden
                        className={cn(
                            "cubing-icon text-[22px]",
                            getEventIconClass(eventId)
                        )}
                    />
                    {activityCodeToName(roundId).replace(", ", " · ")}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted-foreground">
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
                            <b className="font-semibold text-foreground">
                                {meta.cutoff}
                            </b>
                        </span>
                    )}
                    {advancement && <span>{advancement}</span>}
                </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button onClick={onEnterAttempt} className="max-sm:flex-1">
                    <Plus />
                    Enter attempt
                </Button>
                <Button variant="outline" asChild className="max-sm:flex-1">
                    <Link to={`/results/round/${roundId}/enter-scorecard`}>
                        <NotebookPen />
                        Enter scorecard
                    </Link>
                </Button>
                {hasResults && (
                    <Button variant="outline" asChild className="max-sm:flex-1">
                        <Link to={`/results/round/${roundId}/double-check`}>
                            <ClipboardCheck />
                            Double check
                        </Link>
                    </Button>
                )}
                <RowActions
                    subject={activityCodeToName(roundId)}
                    items={[
                        {
                            label: "Public view",
                            icon: Eye,
                            onSelect: () =>
                                navigate(`/results/public/${roundId}`),
                        },
                        {
                            label: `Resubmit to ${platform}`,
                            icon: Send,
                            onSelect: handleResubmit,
                        },
                        {
                            label: "Restart group",
                            icon: RotateCcw,
                            destructive: true,
                            hidden: !hasResults,
                            onSelect: onRestartGroup,
                        },
                    ]}
                />
            </div>
        </div>
    );
};

export default RoundHeader;
