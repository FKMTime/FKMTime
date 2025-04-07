import { activityCodeToName } from "@wca/helpers";
import { CircleCheckBig, OctagonX, Send } from "lucide-react";

import FlagIcon from "@/Components/Icons/FlagIcon";
import PlusButton from "@/Components/PlusButton";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { Attempt, Result } from "@/lib/interfaces";
import {
    assignDnsOnRemainingSolves,
    reSubmitScorecardToWcaLive,
} from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";

interface SingleResultHeaderCardProps {
    result: Result;
    fetchData: () => void;
    setIsOpenCreateAttemptModal: (value: boolean) => void;
    standardAttempts: Attempt[];
    maxAttempts: number;
}

const SingleResultHeaderCard = ({
    result,
    fetchData,
    setIsOpenCreateAttemptModal,
    standardAttempts,
    maxAttempts,
}: SingleResultHeaderCardProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();

    const submissionPlatformName = getSubmissionPlatformName(
        result.eventId || ""
    );

    const handleResubmit = async () => {
        if (!result) return;
        const data = await reSubmitScorecardToWcaLive(result.id);
        if (data.status === 200) {
            toast({
                title: "Success",
                description: `Scorecard resubmitted to ${submissionPlatformName}`,
                variant: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleAssignDns = async () => {
        if (!result) return;
        confirm({
            title: "Assign DNS",
            description:
                "Are you sure you want to assign DNS on remaining attempts?",
        })
            .then(async () => {
                const status = await assignDnsOnRemainingSolves(result.id);
                if (status === 200) {
                    toast({
                        title: "Success",
                        description: "DNS assigned",
                        variant: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description: "Operation has been cancelled",
                });
            });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <FlagIcon
                            country={result.person.countryIso2}
                            size={30}
                        />
                        {result.person.name} ({result.person.registrantId}) -{" "}
                        {activityCodeToName(result.roundId)}
                    </div>
                    <PlusButton
                        onClick={() => setIsOpenCreateAttemptModal(true)}
                    />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {result.isDoubleChecked && result.doubleCheckedAt && (
                    <div className="flex flex-row gap-2 text-green-500 font-semibold items-center">
                        <CircleCheckBig /> Double checked at{" "}
                        {new Date(result.doubleCheckedAt).toLocaleString()} by{" "}
                        {result.doubleCheckedBy?.fullName}
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4">
                    <Button onClick={handleResubmit} variant="success">
                        <Send />
                        Resubmit scorecard to {submissionPlatformName}
                    </Button>
                    {standardAttempts.length < maxAttempts && (
                        <Button onClick={handleAssignDns}>
                            <OctagonX />
                            Assign DNS on remaing attempts
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default SingleResultHeaderCard;
