import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { JudgeRankingEntry } from "@/lib/interfaces";

interface SingleCompetitorJudgesCardProps {
    data: JudgeRankingEntry[];
}

const isMajority = (entry: JudgeRankingEntry) =>
    entry.topCompetitorCount !== undefined &&
    entry.count > 0 &&
    entry.topCompetitorCount / entry.count > 0.5;

const SingleCompetitorJudgesCard = ({
    data,
}: SingleCompetitorJudgesCardProps) => {
    const flagged = data.filter(isMajority);
    if (flagged.length === 0) return null;

    return (
        <Card className="border-amber-500/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle size={18} />
                    Judges mostly judging one competitor
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {flagged.map((entry) => {
                        const pct = Math.round(
                            (entry.topCompetitorCount! / entry.count) * 100
                        );
                        return (
                            <div
                                key={entry.personName}
                                className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                        {entry.personName}
                                    </span>
                                    {entry.topCompetitorName && (
                                        <span className="text-xs text-muted-foreground">
                                            {pct}% of attempts judging{" "}
                                            {entry.topCompetitorName}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm tabular-nums text-muted-foreground">
                                    {entry.topCompetitorCount}/{entry.count}{" "}
                                    attempts
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default SingleCompetitorJudgesCard;
