import { ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { SuspiciousAverage } from "@/lib/interfaces";

interface SuspiciousAveragesCardProps {
    data: SuspiciousAverage[];
}

const SuspiciousAveragesCard = ({ data }: SuspiciousAveragesCardProps) => {
    if (data.length === 0) return null;

    return (
        <Card className="border-destructive/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <ShieldAlert size={18} />
                    Averages with single station & judge
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {data.map((entry, i) => (
                        <div
                            key={i}
                            className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {entry.competitorName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {entry.roundName}
                                </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                {entry.attemptCount} attempts · judged by{" "}
                                {entry.judgeName ?? "unknown"} at{" "}
                                {entry.stationName ?? "unknown station"}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default SuspiciousAveragesCard;
