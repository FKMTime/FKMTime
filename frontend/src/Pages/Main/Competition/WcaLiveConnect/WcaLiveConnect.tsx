import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import {
    connectIntegratedLive,
    integratedLiveConnectionQuery,
} from "@/lib/integratedLive";
import { queryClient } from "@/lib/queryClient";

/** The WCA sends the user back here after they connect live results */
const WcaLiveConnect = () => {
    const [searchParams] = useSearchParams();
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(
        code ? null : "The WCA website didn't send a sign-in code."
    );
    // A code works once: never send it twice, even when effects run twice
    const sent = useRef(false);

    useEffect(() => {
        if (!code || sent.current) return;
        sent.current = true;
        connectIntegratedLive(code)
            .then(({ status, data }) => {
                if (status !== 200) {
                    setError(data?.message ?? "The connection failed.");
                    return;
                }
                void queryClient.invalidateQueries({
                    queryKey: [integratedLiveConnectionQuery.key],
                });
                toast({
                    title: `Connected to Integrated Live Results as ${data.connectedAs ?? "your WCA account"}`,
                    variant: "success",
                });
                navigate("/competition", { replace: true });
            })
            .catch(() => setError("The connection failed."));
    }, [code, navigate, toast]);

    if (!error) return <LoadingPage />;

    return (
        <EmptyState
            action={
                <Button asChild variant="outline">
                    <Link to="/competition">Back to settings</Link>
                </Button>
            }
        >
            Couldn't connect to Integrated Live Results. {error}
        </EmptyState>
    );
};

export default WcaLiveConnect;
