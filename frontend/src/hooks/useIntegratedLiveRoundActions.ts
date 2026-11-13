import { useAtomValue } from "jotai";
import { Lock, LockOpen, UserPlus } from "lucide-react";
import { useState } from "react";

import { RowAction } from "@/Components/shared/RowActions";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    closeIntegratedLiveRound,
    integratedLiveRoundsQuery,
    invalidateIntegratedLiveRounds,
    openIntegratedLiveRound,
} from "@/lib/integratedLive";
import { isOrganizerOrDelegate } from "@/lib/permissions";

/**
 * The round header's WCA Integrated Live Results actions (SPEC-006 section
 * 4): open, close, and add a competitor to a first round. Empty unless results
 * go there, the competition is connected and the user may run rounds.
 */
export const useIntegratedLiveRoundActions = (roundId: string) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const enabled =
        isOrganizerOrDelegate() &&
        competition?.officialResultsDestination === "WCA_INTEGRATED_LIVE" &&
        competition.integratedLiveConnection === "CONNECTED";
    const { data: rounds } = useLiveQuery(integratedLiveRoundsQuery, {
        enabled,
    });
    const round = rounds?.find((r) => r.roundId === roundId);
    const name = activityCodeToName(roundId);
    const isFirstRound = roundId.endsWith("-r1");

    const report = (ok: boolean, success: string, message: string) => {
        toast(
            ok
                ? { title: success, variant: "success" }
                : {
                      title: "Error",
                      description: message,
                      variant: "destructive",
                  }
        );
        void invalidateIntegratedLiveRounds();
    };

    const open = () =>
        confirm({
            title: `Open ${name} in WCA Integrated Live Results?`,
            description: isFirstRound
                ? "Its results are sent there from now on."
                : "This locks the round before it: corrections there will no longer change who advances.",
            confirmLabel: "Open",
            variant: "default",
            onConfirm: async () => {
                const { ok, message } = await openIntegratedLiveRound(roundId);
                report(ok, `${name} opened`, message);
            },
        }).catch(() => undefined);

    const close = () =>
        confirm({
            title: `Close ${name} in WCA Integrated Live Results?`,
            description:
                "Undoes opening it by mistake, and unlocks the round before it. Only possible while it has no results.",
            confirmLabel: "Close",
            onConfirm: async () => {
                const { ok, message } = await closeIntegratedLiveRound(roundId);
                report(ok, `${name} closed`, message);
            },
        }).catch(() => undefined);

    const items: RowAction[] =
        !enabled || !round
            ? []
            : [
                  {
                      label: "Open in WCA Integrated Live Results",
                      icon: LockOpen,
                      hidden: round.state !== "ready",
                      onSelect: open,
                  },
                  {
                      label: "Add competitor to round",
                      icon: UserPlus,
                      hidden: !isFirstRound || round.state !== "open",
                      onSelect: () => setIsAddOpen(true),
                  },
                  {
                      label: "Close in WCA Integrated Live Results",
                      icon: Lock,
                      destructive: true,
                      hidden:
                          round.state !== "open" ||
                          (round.completedCompetitors ?? 0) > 0,
                      onSelect: close,
                  },
              ];

    return {
        items,
        isAddOpen,
        closeAdd: () => setIsAddOpen(false),
    };
};
