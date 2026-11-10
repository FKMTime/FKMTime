import { Undo2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { Result } from "@/lib/interfaces";
import { bringBackResult } from "@/lib/results";
import { shortRoundName } from "@/lib/utils";

interface RemovedResultBannerProps {
    result: Result;
    onBroughtBack: () => void;
}

/** Why a result counts nowhere, and the way back */
const RemovedResultBanner = ({
    result,
    onBroughtBack,
}: RemovedResultBannerProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const ruling = result.removedByRulingOf;

    const handleBringBack = () =>
        confirm({
            title: "Bring this result back?",
            description:
                "It counts again as it was, and the scorecard is sent again.",
            confirmLabel: "Bring back",
            onConfirm: async () => {
                const { status, message } = await bringBackResult(result.id);
                if (status === 200) {
                    toast({ title: "Result brought back", variant: "success" });
                    onBroughtBack();
                } else {
                    toast({
                        title: "Error",
                        description: message ?? "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);

    return (
        <section
            role="status"
            aria-label="Removed result"
            className="flex flex-wrap items-center justify-between gap-3 rounded-mobile-card border border-destructive/40 bg-card px-5 py-[18px] md:rounded-2xl"
        >
            <div className="text-sm">
                <p className="font-semibold">
                    Removed from this round under Regulation 9t
                    {ruling && (
                        <>
                            , after the ruling in{" "}
                            <Link
                                to={`/results/${ruling.id}`}
                                className="text-primary hover:underline"
                            >
                                {shortRoundName(ruling.roundId)}
                            </Link>
                        </>
                    )}
                </p>
                <p className="text-muted-foreground">
                    {[
                        result.removedReason,
                        result.removedBy?.fullName &&
                            `by ${result.removedBy.fullName}`,
                        result.removedAt &&
                            new Date(result.removedAt).toLocaleString(),
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                <p className="text-muted-foreground">
                    {ruling
                        ? "Restoring that ruling brings it back."
                        : "It counts nowhere until it is brought back."}
                </p>
            </div>
            {!ruling && (
                <Button variant="outline" size="sm" onClick={handleBringBack}>
                    <Undo2 />
                    Bring back
                </Button>
            )}
        </section>
    );
};

export default RemovedResultBanner;
