import { CircleCheck, OctagonX, Plus, Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import RowActions from "@/Components/shared/RowActions";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { Attempt, Result } from "@/lib/interfaces";
import { WCA_ORIGIN } from "@/lib/request";
import {
    assignDnsOnRemainingSolves,
    deleteResultById,
    reSubmitScorecardToWcaLive,
} from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";

interface SingleResultHeaderProps {
    result: Result;
    fetchData: () => void;
    onEnterAttempt: () => void;
    standardAttempts: Attempt[];
    maxAttempts: number;
}

const SingleResultHeader = ({
    result,
    fetchData,
    onEnterAttempt,
    standardAttempts,
    maxAttempts,
}: SingleResultHeaderProps) => {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { toast } = useToast();
    const platform = getSubmissionPlatformName(result.eventId || "");

    const report = (ok: boolean, success: string) =>
        toast(
            ok
                ? { title: success, variant: "success" }
                : {
                      title: "Error",
                      description: "Something went wrong",
                      variant: "destructive",
                  }
        );

    const handleResubmit = async () => {
        const response = await reSubmitScorecardToWcaLive(result.id);
        report(response.status === 200, `Scorecard resubmitted to ${platform}`);
    };

    const handleAssignDns = () =>
        confirm({
            title: "Assign DNS on the remaining attempts?",
            confirmLabel: "Assign DNS",
            onConfirm: async () => {
                const status = await assignDnsOnRemainingSolves(result.id);
                report(status === 200, "DNS assigned");
                if (status === 200) fetchData();
            },
        }).catch(() => undefined);

    const handleDelete = () =>
        confirm({
            title: `Delete the result of ${result.person.name}?`,
            description: "This deletes every attempt in this result.",
            confirmLabel: "Delete result",
            onConfirm: async () => {
                const status = await deleteResultById(result.id);
                report(status === 204, "Successfully deleted result.");
                if (status === 204)
                    navigate(`/results/round/${result.roundId}`);
            },
        }).catch(() => undefined);

    const groupNumber = result.groupId?.split("-g")[1];

    return (
        <header className="flex flex-wrap items-start gap-x-3 gap-y-3">
            <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3">
                {result.person.countryIso2 && (
                    <FlagIcon country={result.person.countryIso2} size={28} />
                )}
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold">
                        {result.person.name}
                        {result.person.registrantId && (
                            <span className="font-normal text-muted-foreground">
                                {" "}
                                ({result.person.registrantId})
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {activityCodeToName(result.roundId).replace(
                            ", ",
                            " · "
                        )}
                        {groupNumber && ` · Group ${groupNumber}`}
                        {" · "}
                        {result.person.wcaId ? (
                            <a
                                href={`${WCA_ORIGIN}/persons/${result.person.wcaId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                            >
                                {result.person.wcaId}
                            </a>
                        ) : (
                            "Newcomer"
                        )}
                    </p>
                    {result.isDoubleChecked && result.doubleCheckedAt && (
                        <StatusBadge tone="success" className="mt-1.5">
                            <CircleCheck />
                            Double checked{" "}
                            {new Date(result.doubleCheckedAt).toLocaleString()}
                            {result.doubleCheckedBy?.fullName &&
                                ` by ${result.doubleCheckedBy.fullName}`}
                        </StatusBadge>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1">
                <Button onClick={onEnterAttempt}>
                    <Plus />
                    Enter attempt
                </Button>
                <RowActions
                    subject={result.person.name}
                    items={[
                        {
                            label: `Resubmit scorecard to ${platform}`,
                            icon: Send,
                            onSelect: handleResubmit,
                        },
                        {
                            label: "Assign DNS on remaining attempts",
                            icon: OctagonX,
                            hidden: standardAttempts.length >= maxAttempts,
                            onSelect: handleAssignDns,
                        },
                        {
                            label: "Delete result",
                            icon: Trash2,
                            destructive: true,
                            onSelect: handleDelete,
                        },
                    ]}
                />
            </div>
        </header>
    );
};

export default SingleResultHeader;
