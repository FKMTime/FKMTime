import { Loader2 } from "lucide-react";

import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import { WCACompetition } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

import { competitionMeta } from "./competitionMeta";

interface CompetitionsListProps {
    competitions: WCACompetition[];
    importingId: string | null;
    error: { competitionId: string; message: string } | null;
    onImport: (wcaId: string) => void;
}

const CompetitionsList = ({
    competitions,
    importingId,
    error,
    onImport,
}: CompetitionsListProps) => {
    if (!competitions.length) {
        return (
            <div className="rounded-2xl border bg-card px-5 py-10 text-center text-muted-foreground">
                You have no upcoming competitions to manage
            </div>
        );
    }

    return (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {competitions.map((competition) => {
                const isImporting = importingId === competition.id;
                return (
                    <li
                        key={competition.id}
                        className="flex flex-col gap-2 py-3.5 pl-5 pr-3.5"
                    >
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                                <span className="text-[15px] font-semibold">
                                    {competition.name}
                                </span>
                                <span className="text-[13px] text-muted-foreground">
                                    {competitionMeta(competition)}
                                </span>
                            </div>
                            <Button
                                onClick={() => onImport(competition.id)}
                                disabled={importingId !== null}
                                className={cn(
                                    isImporting && "disabled:opacity-100"
                                )}
                            >
                                {isImporting && (
                                    <Loader2 className="animate-spin" />
                                )}
                                {isImporting ? "Importing…" : "Import"}
                            </Button>
                        </div>
                        {error?.competitionId === competition.id && (
                            <InlineError>{error.message}</InlineError>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default CompetitionsList;
