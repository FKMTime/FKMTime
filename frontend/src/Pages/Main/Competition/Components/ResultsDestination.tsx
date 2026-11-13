import { useSetAtom } from "jotai";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    competitionSettingsQuery,
    refreshScoretakingSoftware,
} from "@/lib/competition";
import { Competition } from "@/lib/interfaces";
import { setQueryData } from "@/lib/queryCache";
import { WCA_ORIGIN } from "@/lib/request";
import { officialResultsDestinationName } from "@/lib/utils";

interface ResultsDestinationProps {
    competition: Competition;
}

const explanation = (software: string | null | undefined) => {
    switch (software) {
        case "wca_live":
            return "The WCA website says results are entered in WCA Live.";
        case "internal":
            return "The WCA website says results are entered in its own live results. FKMTime can't send them there yet, so official results aren't sent anywhere for now.";
        case "external":
            return "The WCA website says results are entered with another tool, so FKMTime doesn't send official results anywhere.";
        default:
            return "Not checked with the WCA website yet. Until then, results go to WCA Live if a scoretaking token is set.";
    }
};

/**
 * Where official results go. It follows the competition's scoretaking setting
 * on the WCA website, which FKMTime can only read (SPEC-006)
 */
const ResultsDestination = ({ competition }: ResultsDestinationProps) => {
    const { toast } = useToast();
    const setCompetition = useSetAtom(competitionAtom);
    const [isChecking, setIsChecking] = useState(false);

    const checkAgain = async () => {
        setIsChecking(true);
        const { data } = await refreshScoretakingSoftware().catch(() => ({
            data: null,
        }));
        setIsChecking(false);
        if (!data) {
            toast({
                title: "Couldn't check with the WCA website",
                variant: "destructive",
            });
            return;
        }
        setQueryData<Competition>(competitionSettingsQuery.key, (previous) => ({
            ...(previous as Competition),
            ...data,
        }));
        setCompetition((previous) =>
            previous ? { ...previous, ...data } : previous
        );
    };

    const checkedAt = competition.wcaScoretakingCheckedAt
        ? new Date(competition.wcaScoretakingCheckedAt).toLocaleString()
        : null;

    return (
        <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-muted-foreground">
                Official results go to
            </p>
            <p className="font-semibold">
                {officialResultsDestinationName(
                    competition.officialResultsDestination
                )}
            </p>
            <p className="text-[13px] text-muted-foreground">
                {explanation(competition.wcaScoretakingSoftware)}
                {checkedAt && ` Checked ${checkedAt}.`}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={checkAgain}
                    disabled={isChecking}
                >
                    <RefreshCw />
                    Check again
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                    <a
                        href={`${WCA_ORIGIN}/competitions/${competition.wcaId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ExternalLink />
                        Change on the WCA website
                    </a>
                </Button>
            </div>
        </div>
    );
};

export default ResultsDestination;
