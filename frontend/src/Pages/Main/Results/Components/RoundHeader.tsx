import {
    ClipboardCheck,
    Eye,
    NotebookPen,
    Plus,
    RotateCcw,
    Send,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import ClearRoundModal from "@/Components/IntegratedLive/ClearRoundModal";
import RowActions from "@/Components/shared/RowActions";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useIntegratedLiveRoundActions } from "@/hooks/useIntegratedLiveRoundActions";
import { useIsMobile } from "@/hooks/useMobile";
import { useSubmissionPlatformName } from "@/hooks/useSubmissionPlatformName";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { IntegratedLiveRoundDetails } from "@/lib/interfaces";
import { reSubmitRoundToWcaLive } from "@/lib/results";
import { RoundMeta } from "@/lib/roundInfo";

import AddCompetitorToRoundModal from "./AddCompetitorToRoundModal";
import RoundMetaLine from "./RoundMetaLine";

interface RoundHeaderProps {
    roundId: string;
    meta: RoundMeta | null;
    advancement?: string | null;
    /** The round in WCA Integrated Live Results, when results go there */
    live?: IntegratedLiveRoundDetails;
    hasResults: boolean;
    onEnterAttempt: () => void;
    onRestartGroup: () => void;
}

const RoundHeader = ({
    roundId,
    meta,
    advancement,
    live,
    hasResults,
    onEnterAttempt,
    onRestartGroup,
}: RoundHeaderProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const eventId = roundId.split("-")[0];
    const platform = useSubmissionPlatformName()(eventId);
    const integratedLive = useIntegratedLiveRoundActions(roundId);
    const isMobile = useIsMobile();

    const handleResubmit = () => {
        confirm({
            title: `Resubmit results to ${platform}?`,
            description: `This overrides the round's results on ${platform}.`,
            confirmLabel: "Resubmit",
            variant: "default",
            onConfirm: async () => {
                const { status, message } =
                    await reSubmitRoundToWcaLive(roundId);
                if (status === 200) {
                    toast({
                        title: `Results resubmitted to ${platform}`,
                        description: message,
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

    const menu = (
        <RowActions
            subject={activityCodeToName(roundId)}
            items={[
                {
                    label: "Public view",
                    icon: Eye,
                    onSelect: () => navigate(`/results/public/${roundId}`),
                },
                {
                    label: `Resubmit to ${platform}`,
                    icon: Send,
                    hidden: !platform,
                    onSelect: handleResubmit,
                },
                ...integratedLive.items,
                {
                    label: "Restart group",
                    icon: RotateCcw,
                    destructive: true,
                    hidden: !hasResults,
                    onSelect: onRestartGroup,
                },
            ]}
        />
    );

    return (
        <>
            {/* The round's name is the page heading; on desktop the details sit in the results card */}
            <div className="flex flex-col gap-3 lg:shrink-0">
                {isMobile && (
                    <div className="flex items-center gap-2">
                        <RoundMetaLine
                            meta={meta}
                            advancement={advancement}
                            live={live}
                            className="min-w-0 flex-1"
                        />
                        {menu}
                    </div>
                )}
                <div className="flex w-full flex-wrap gap-2 md:justify-end lg:w-auto lg:flex-nowrap">
                    {/* Phones use the floating Enter attempt button instead */}
                    {!isMobile && (
                        <Button onClick={onEnterAttempt}>
                            <Plus />
                            Enter attempt
                        </Button>
                    )}
                    <Button variant="outline" asChild className="max-md:flex-1">
                        <Link to={`/results/round/${roundId}/enter-scorecard`}>
                            <NotebookPen />
                            Enter scorecard
                        </Link>
                    </Button>
                    {hasResults && (
                        <Button
                            variant="outline"
                            asChild
                            className="max-md:flex-1"
                        >
                            <Link to={`/results/round/${roundId}/double-check`}>
                                <ClipboardCheck />
                                Double check
                            </Link>
                        </Button>
                    )}
                    {!isMobile && menu}
                </div>
            </div>
            <AddCompetitorToRoundModal
                isOpen={integratedLive.isAddOpen}
                onClose={integratedLive.closeAdd}
                roundId={roundId}
            />
            <ClearRoundModal
                isOpen={integratedLive.isClearOpen}
                onClose={integratedLive.closeClear}
                roundId={roundId}
            />
        </>
    );
};

export default RoundHeader;
