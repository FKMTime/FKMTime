import { ChartNoAxesColumn, User } from "lucide-react";
import { useEffect, useState } from "react";

import StatCard from "@/Components/StatCard";
import { getCompetitionStatistics } from "@/lib/competition";
import { CompetitionStatistics as ICompetitionStatistics } from "@/lib/interfaces";
import { socket } from "@/socket";

import Charts from "./Charts";

interface CompetitionStatisticsProps {
    showCharts?: boolean;
}

const CompetitionStatistics = ({ showCharts }: CompetitionStatisticsProps) => {
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
            title: "Solves entered manually",
            stat: statistics.attemptsEnteredManually.toString() || "0",
            icon: <ChartNoAxesColumn size={24} />,
        },
        {
            title: "Scorecards",
            stat: statistics.scorecardsCount.toString() || "0",
            icon: <ChartNoAxesColumn size={24} />,
        },
        {
            title: "Competitors",
            stat: statistics.personsCompeted.toString() || "0",
            icon: <User size={24} />,
        },
    ];

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
