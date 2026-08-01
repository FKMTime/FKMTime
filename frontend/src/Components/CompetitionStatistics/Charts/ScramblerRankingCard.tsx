import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { JudgeRankingEntry } from "@/lib/interfaces";

interface ScramblerRankingCardProps {
    data: JudgeRankingEntry[];
}

const ScramblerRankingCard = ({ data }: ScramblerRankingCardProps) => {
    if (data.length === 0) return null;

    const max = data[0].count;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Most scrambled attempts</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {data.map((entry, i) => (
                        <div
                            key={entry.personName}
                            className="flex items-center gap-3"
                        >
                            <span className="text-sm text-muted-foreground w-6 text-right shrink-0">
                                {i + 1}.
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-sm font-medium truncate">
                                        {entry.personName}
                                    </span>
                                    <span className="text-sm tabular-nums ml-4 shrink-0">
                                        {entry.count}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                            width: `${(entry.count / max) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ScramblerRankingCard;
