import {
    ChartNoAxesColumn,
    Keyboard,
    Layers,
    RefreshCw,
    User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { getCompetitionStatistics } from "@/lib/competition";
import { CompetitionStatistics as ICompetitionStatistics } from "@/lib/interfaces";
import { socket } from "@/socket";

import StatCard from "../StatCard";
import Charts from "./Charts";

interface CompetitionStatisticsProps {
    showCharts?: boolean;
    combined?: boolean;
}

const CompetitionStatistics = ({
    showCharts,
    combined,
}: CompetitionStatisticsProps) => {
    const [statistics, setStatistics] = useState<ICompetitionStatistics | null>(
        null
    );

    const fetchData = () => {
        getCompetitionStatistics().then((data) => {
            setStatistics(data);
        });
    };

    useEffect(() => {
        fetchData();

        socket.emit("joinStatistics");

        socket.on("statisticsUpdated", () => {
            fetchData();
        });

        return () => {
            socket.emit("leaveStatistics");
        };
    }, []);

    if (!statistics) return null;

    const cardStats = [
        {
            title: "Total solves",
            stat: statistics.allAttempts.toString() || "0",
            icon: <ChartNoAxesColumn size={24} />,
        },
        {
            title: "Manually entered",
            stat: statistics.attemptsEnteredManually.toString() || "0",
            icon: <Keyboard size={24} />,
        },
        {
            title: "Extra attempts",
            stat: statistics.extraAttemptsUsed.toString() || "0",
            icon: <RefreshCw size={24} />,
        },
        {
            title: "Scorecards",
            stat: statistics.scorecardsCount.toString() || "0",
            icon: <Layers size={24} />,
        },
        {
            title: "Competitors",
            stat: statistics.personsCompeted.toString() || "0",
            icon: <User size={24} />,
        },
    ];

    if (combined) {
        return (
            <>
                <Card className="md:hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            {cardStats.map((card) => (
                                <div
                                    key={card.title}
                                    className="flex flex-col gap-1"
                                >
                                    <span className="text-xs text-muted-foreground flex gap-1 items-center [&>svg]:h-3 [&>svg]:w-3">
                                        {card.icon}
                                        {card.title}
                                    </span>
                                    <span className="text-2xl font-bold">
                                        {card.stat}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <div className="hidden md:flex gap-4">
                    {cardStats.map((card) => (
                        <StatCard
                            key={card.title}
                            title={card.title}
                            stat={card.stat}
                            icon={card.icon}
                        />
                    ))}
                </div>
            </>
        );
    }

    if (!showCharts) {
        return (
            <>
                {cardStats.map((card) => (
                    <StatCard
                        key={card.title}
                        title={card.title}
                        stat={card.stat}
                        icon={card.icon}
                    />
                ))}
            </>
        );
    }

    return (
        <div className="mt-2 flex flex-col gap-3">
            <div className="flex gap-3">
                {cardStats.map((card) => (
                    <StatCard
                        key={card.title}
                        title={card.title}
                        stat={card.stat}
                        icon={card.icon}
                    />
                ))}
            </div>
            {showCharts && <Charts statistics={statistics} />}
        </div>
    );
};

export default CompetitionStatistics;
