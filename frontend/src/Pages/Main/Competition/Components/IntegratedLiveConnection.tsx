import { Link2, Link2Off, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    disconnectIntegratedLive,
    integratedLiveConnectionQuery,
    startIntegratedLiveConnect,
} from "@/lib/integratedLive";
import { queryClient } from "@/lib/queryClient";

/**
 * The competition's connection to the WCA's live results: the WCA account
 * every result is entered as (SPEC-006 section 2)
 */
const IntegratedLiveConnection = () => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const { data: connection } = useLiveQuery(integratedLiveConnectionQuery);
    const [isLeaving, setIsLeaving] = useState(false);

    if (!connection) return null;

    const connect = () => {
        setIsLeaving(true);
        startIntegratedLiveConnect();
    };

    const disconnect = () =>
        confirm({
            title: "Disconnect from Integrated Live Results?",
            description:
                "Results won't be sent to the WCA website until someone connects again.",
            confirmLabel: "Disconnect",
            onConfirm: async () => {
                const status = await disconnectIntegratedLive();
                if (status === 200) {
                    void queryClient.invalidateQueries({
                        queryKey: [integratedLiveConnectionQuery.key],
                    });
                    toast({
                        title: "Disconnected from Integrated Live Results",
                        variant: "success",
                    });
                } else {
                    toast({
                        title: "Could not disconnect",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);

    const { state, connectedAs, canEnterScores } = connection;

    return (
        <div className="space-y-2 rounded-xl border p-3">
            <p className="text-[13px] font-semibold text-muted-foreground">
                Connection to Integrated Live Results
            </p>
            {state === "NOT_CONNECTED" && (
                <p className="text-[13px] text-muted-foreground">
                    Sign in with the WCA account results should be entered as:
                    an organiser, a Delegate, or a scoretaker of this
                    competition.
                </p>
            )}
            {state !== "NOT_CONNECTED" && (
                <p className="text-sm">
                    Connected as{" "}
                    <span className="font-semibold">
                        {connectedAs ?? "an unknown account"}
                    </span>
                    . Results are entered as this person.
                </p>
            )}
            {state === "BROKEN" && (
                <Alert variant="warning">
                    <TriangleAlert />
                    <AlertTitle>
                        Integrated Live Results disconnected. Reconnect to keep
                        sending results.
                    </AlertTitle>
                </Alert>
            )}
            {state === "CONNECTED" && canEnterScores === false && (
                <Alert variant="warning">
                    <TriangleAlert />
                    <AlertTitle>
                        This account can't enter results for this competition.
                        Reconnect as an organiser, a Delegate or a scoretaker.
                    </AlertTitle>
                </Alert>
            )}
            {state === "CONNECTED" && canEnterScores === null && (
                <p className="text-[13px] text-muted-foreground">
                    The WCA website couldn't confirm this account may enter
                    results.
                </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
                <Button
                    type="button"
                    size="sm"
                    variant={state === "CONNECTED" ? "outline" : "default"}
                    onClick={connect}
                    disabled={isLeaving}
                >
                    <Link2 />
                    {state === "NOT_CONNECTED"
                        ? "Connect to Integrated Live Results"
                        : "Reconnect"}
                </Button>
                {state !== "NOT_CONNECTED" && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={disconnect}
                    >
                        <Link2Off />
                        Disconnect
                    </Button>
                )}
            </div>
        </div>
    );
};

export default IntegratedLiveConnection;
