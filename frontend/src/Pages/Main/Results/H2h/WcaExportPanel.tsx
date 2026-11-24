import { Download } from "lucide-react";
import { useState } from "react";

import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { downloadH2hCsv, h2hExportChecksQuery } from "@/lib/h2h";
import UnlockCard from "@/Pages/ScramblingDevice/Components/UnlockCard";

interface WcaExportPanelProps {
    roundId: string;
}

/**
 * Download results for WCA (CSV), once the bracket is finished (SPEC-001).
 * Lists what still blocks the file before asking for the scramble
 * password, which the file needs for its scrambles.
 */
const WcaExportPanel = ({ roundId }: WcaExportPanelProps) => {
    const {
        data: checks,
        isError,
        refetch,
    } = useLiveQuery(h2hExportChecksQuery(roundId));
    const { toast } = useToast();
    const [isAsking, setIsAsking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState("");
    // Blockers the download itself found, until the checks catch up
    const [refused, setRefused] = useState<string[] | null>(null);

    if (!checks) {
        return isError ? (
            <RequestError onRetry={() => void refetch()} />
        ) : (
            <SectionLoading label="Checking the results for the WCA" />
        );
    }
    const blockers = refused ?? checks.blockers;

    const handleDownload = async (password: string) => {
        setIsDownloading(true);
        const result = await downloadH2hCsv(roundId, password);
        setIsDownloading(false);
        if (result.ok) {
            setIsAsking(false);
            toast({ title: "Results downloaded", variant: "success" });
            return;
        }
        if (result.blockers) {
            setRefused(result.blockers);
            setIsAsking(false);
            void refetch();
            return;
        }
        setError(result.message);
    };

    return (
        <section
            aria-label="Results for the WCA"
            className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5"
        >
            <div className="flex flex-col gap-1">
                <h2 className="text-base font-bold">Results for the WCA</h2>
                <p className="text-sm text-muted-foreground">
                    The WCA website takes head-to-head results as a CSV file,
                    with every match, set and attempt in it.
                </p>
            </div>
            {blockers.length > 0 ? (
                <div role="alert" className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">
                        Fix these before downloading:
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                        {blockers.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                        ))}
                    </ul>
                    <Button
                        variant="outline"
                        className="self-start"
                        onClick={() => {
                            setRefused(null);
                            void refetch();
                        }}
                    >
                        Check again
                    </Button>
                </div>
            ) : isAsking ? (
                <UnlockCard
                    setName="Download results for WCA (CSV)"
                    description="Enter the scramble password: the file has the scrambles in it"
                    submitLabel="Download"
                    error={error}
                    isUnlocking={isDownloading}
                    onUnlock={(password) => void handleDownload(password)}
                    onChange={() => setError("")}
                />
            ) : (
                <Button
                    className="self-start"
                    onClick={() => {
                        setError("");
                        setIsAsking(true);
                    }}
                >
                    <Download className="size-4" />
                    Download results for WCA (CSV)
                </Button>
            )}
        </section>
    );
};

export default WcaExportPanel;
